using System.Net;
using System.Text;
using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Ai;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Tiêu chí đánh giá per-job (5.7, 5.18): CRUD + AI bóc DRAFT từ JD + người duyệt chốt.
/// </summary>
public class EvaluationCriteriaService : BaseService<EvaluationCriteriaService>, IEvaluationCriteriaService
{
    private readonly IEvaluationCriteriaRepo _criteriaRepo;
    private readonly IJobRepo _jobRepo;
    private readonly IApplicationRepo _applicationRepo;
    private readonly IApplicationStateService _stateService;
    private readonly ICriteriaExtractionClient _extractionClient;
    private readonly ILogger _logger;

    public EvaluationCriteriaService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _criteriaRepo = serviceProvider.GetRequiredService<IEvaluationCriteriaRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _applicationRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _stateService = serviceProvider.GetRequiredService<IApplicationStateService>();
        _extractionClient = serviceProvider.GetRequiredService<ICriteriaExtractionClient>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<EvaluationCriteriaService>();
    }

    public async Task<CriteriaDto> CreateAsync(long companyId, long jobId, CriteriaInputDto dto)
    {
        Validate(dto.Name, dto.Weight, dto.MaxScore, dto.CriteriaType);

        var entity = new EvaluationCriteria
        {
            JobId = jobId,
            Name = dto.Name.Trim(),
            Weight = dto.Weight,
            MaxScore = dto.MaxScore,
            Active = true,
            CriteriaType = dto.CriteriaType.ToUpperInvariant(),
            CvMatchable = dto.CvMatchable,
            Keywords = NormalizeKeywords(dto.Keywords),
            // Người gõ trực tiếp = tự ra đề cho mình -> APPROVED luôn, không cần vòng duyệt.
            Source = CriteriaSource.Manual,
            Status = CriteriaStatus.Approved
        };
        var id = await _criteriaRepo.InsertAsync(companyId, entity);
        entity.CriteriaId = id;
        return Map(entity);
    }

    public async Task<IReadOnlyList<CriteriaDto>> GetByJobAsync(long companyId, long jobId, bool includeInactive = false)
    {
        // approvedOnly:false — màn quản lý/duyệt thấy cả DRAFT (kèm status để FE phân biệt).
        var list = await _criteriaRepo.GetByJobAsync(companyId, jobId, activeOnly: !includeInactive, approvedOnly: false);
        return list.Select(Map).ToList();
    }

    public async Task<CriteriaDto> UpdateAsync(long companyId, long criteriaId, CriteriaUpdateDto dto)
    {
        Validate(dto.Name, dto.Weight, dto.MaxScore, dto.CriteriaType);

        var existing = await _criteriaRepo.GetByIdAsync(companyId, criteriaId)
            ?? throw NotFound($"Không tìm thấy tiêu chí (criteria_id={criteriaId}).");

        await _criteriaRepo.UpdateAsync(companyId, criteriaId, dto.Name.Trim(), dto.Weight, dto.MaxScore,
            dto.Active, dto.CriteriaType.ToUpperInvariant(), dto.CvMatchable, NormalizeKeywords(dto.Keywords));

        existing.Name = dto.Name.Trim();
        existing.Weight = dto.Weight;
        existing.MaxScore = dto.MaxScore;
        existing.Active = dto.Active;
        existing.CriteriaType = dto.CriteriaType.ToUpperInvariant();
        existing.CvMatchable = dto.CvMatchable;
        existing.Keywords = NormalizeKeywords(dto.Keywords);
        return Map(existing);
    }

    public async Task<IReadOnlyList<CriteriaDto>> ExtractDraftAsync(long companyId, long jobId)
    {
        var job = await _jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (job_id={jobId}).");
        var requirements = await _jobRepo.GetRequirementsAsync(companyId, jobId);

        // AI phải đọc CẢ BA ô người dùng nhập, không riêng jd_text: "yêu cầu ứng viên" và
        // "kỹ năng" mới là chỗ chứa thứ bóc được thành tiêu chí, còn mô tả công việc thường
        // chỉ liệt kê đầu việc. Chỉ gửi jd_text = bỏ đúng phần dữ liệu giá trị nhất, rồi báo
        // người dùng "chưa nêu yêu cầu nào" trong khi họ đã nhập yêu cầu đầy đủ.
        var sourceText = BuildSourceText(job.JdText, requirements, job.SkillTags);
        if (string.IsNullOrWhiteSpace(sourceText))
            throw Bad("Job chưa có mô tả công việc, yêu cầu ứng viên hay kỹ năng nào để bóc tiêu chí.");

        IReadOnlyList<ExtractedCriterion> extracted;
        try
        {
            extracted = await _extractionClient.ExtractAsync(sourceText);
        }
        catch (Exception ex)
        {
            // AI service/Ollama lỗi -> 502 để FE hiện fallback "nhập tiêu chí thủ công".
            _logger.Warning(ex, "ExtractDraft: AI bóc tiêu chí thất bại (job={JobId}).", jobId);
            throw new BaseException("AI bóc tiêu chí thất bại — vui lòng nhập tiêu chí thủ công.")
            {
                ErrorCode = "AI_EXTRACT_FAILED",
                ErrorMessage = "AI bóc tiêu chí thất bại — vui lòng nhập tiêu chí thủ công.",
                HttpStatus = (int)HttpStatusCode.BadGateway
            };
        }

        // Tin tuyển dụng chỉ liệt kê đầu việc, không nêu yêu cầu nào với ứng viên -> AI trả rỗng.
        // Đây KHÔNG phải AI hỏng: báo đúng việc người dùng cần làm, và ném TRƯỚC khi xoá draft cũ
        // để họ không mất bộ tiêu chí đang có chỉ vì bấm bóc lại. Thông báo phải chỉ đúng ô cần
        // sửa — AI đã đọc cả ba mục nên không được nói trống không là "bổ sung phần yêu cầu".
        if (extracted.Count == 0)
        {
            _logger.Information("ExtractDraft: tin tuyển dụng không nêu yêu cầu nào với ứng viên (job={JobId}).", jobId);
            throw new BaseException("Tin tuyển dụng chưa nêu yêu cầu nào với ứng viên.")
            {
                ErrorCode = "JD_NO_REQUIREMENTS",
                ErrorMessage = "Tin tuyển dụng mới chỉ liệt kê đầu việc, chưa nêu yêu cầu nào với " +
                               "ứng viên (bằng cấp, số năm kinh nghiệm, kỹ năng, ngoại ngữ...). " +
                               "Bổ sung mục \"Yêu cầu ứng viên\" hoặc \"Kỹ năng\" rồi bóc lại, " +
                               "hoặc tự nhập tiêu chí.",
                HttpStatus = (int)HttpStatusCode.UnprocessableEntity
            };
        }

        // Bóc lại = thay trọn bộ DRAFT cũ (tiêu chí đã APPROVED giữ nguyên).
        await _criteriaRepo.DeleteDraftsAsync(companyId, jobId);

        var result = new List<CriteriaDto>();
        foreach (var c in extracted)
        {
            var entity = new EvaluationCriteria
            {
                JobId = jobId,
                Name = c.Name,
                Weight = c.Weight,
                MaxScore = 10,
                Active = true,
                CriteriaType = c.Type,
                CvMatchable = c.CvMatchable,
                Keywords = c.Keywords.Count > 0 ? string.Join(";", c.Keywords) : null,
                Source = CriteriaSource.AiExtracted,
                Status = CriteriaStatus.Draft
            };
            entity.CriteriaId = await _criteriaRepo.InsertAsync(companyId, entity);
            result.Add(Map(entity));
        }

        _logger.Information("ExtractDraft: job={JobId} -> {N} tiêu chí DRAFT chờ duyệt.", jobId, result.Count);
        return result;
    }

    public async Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId)
    {
        var approved = await _criteriaRepo.ApproveDraftsAsync(companyId, jobId, userId);
        if (approved == 0)
            throw Bad("Job không có tiêu chí DRAFT nào để duyệt.");

        _logger.Information("ApproveDrafts: user={UserId} duyệt {N} tiêu chí của job={JobId}.",
            userId, approved, jobId);

        // Chốt tiêu chí = mở màn sàng lọc: hồ sơ còn ở "Hồ sơ mới" của job này tự sang "Sàng lọc"
        // (chấm CV theo tiêu chí chỉ có nghĩa sau khi tiêu chí đã chốt — 5.17/5.18).
        // Best-effort: một hồ sơ lỗi không được làm hỏng việc duyệt tiêu chí.
        await AdvanceNewApplicationsToScreeningAsync(companyId, jobId, userId);

        return approved;
    }

    /// <summary>
    /// Đẩy mọi hồ sơ NEW của job sang SCREENING sau khi tiêu chí được duyệt — để người dùng
    /// không phải sang Kanban kéo tay từng card.
    /// </summary>
    private async Task AdvanceNewApplicationsToScreeningAsync(long companyId, long jobId, long userId)
    {
        try
        {
            var board = await _applicationRepo.GetBoardByJobAsync(companyId, jobId);
            var newOnes = board
                .Where(r => string.Equals(r.CurrentState, ApplicationState.New, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (newOnes.Count == 0) return;

            var moved = 0;
            foreach (var row in newOnes)
            {
                try
                {
                    await _stateService.AdvanceToAsync(companyId, userId, row.ApplicationId, ApplicationState.Screening);
                    moved++;
                }
                catch (Exception ex)
                {
                    _logger.Warning(ex, "ApproveDrafts: không đẩy được hồ sơ {AppId} sang SCREENING.", row.ApplicationId);
                }
            }

            if (moved > 0)
                _logger.Information("ApproveDrafts: job={JobId} -> {N} hồ sơ tự chuyển NEW→SCREENING.", jobId, moved);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "ApproveDrafts: bỏ qua bước tự chuyển hồ sơ sang SCREENING (job={JobId}).", jobId);
        }
    }

    public async Task DeactivateAsync(long companyId, long criteriaId)
    {
        var existing = await _criteriaRepo.GetByIdAsync(companyId, criteriaId)
            ?? throw NotFound($"Không tìm thấy tiêu chí (criteria_id={criteriaId}).");
        await _criteriaRepo.DeactivateAsync(companyId, existing.CriteriaId);
    }

    // ============================================================

    /// <summary>
    /// Gộp mô tả công việc + yêu cầu ứng viên + kỹ năng thành 1 văn bản cho AI đọc. Giữ tiêu đề
    /// từng mục để LLM thấy rõ ranh giới đầu việc / yêu cầu — prompt bóc tiêu chí dựa vào đúng
    /// ranh giới đó. Mục trống thì bỏ hẳn, không để tiêu đề rỗng gây nhiễu.
    /// </summary>
    private static string BuildSourceText(
        string? jdText, IReadOnlyList<JobRequirement> requirements, string? skillTags)
    {
        var sb = new StringBuilder();

        if (!string.IsNullOrWhiteSpace(jdText))
            sb.Append("[Mô tả công việc]\n").Append(jdText.Trim()).Append("\n\n");

        var reqLines = requirements
            .Select(r => r.Content?.Trim())
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .ToList();
        if (reqLines.Count > 0)
        {
            sb.Append("[Yêu cầu ứng viên]\n");
            foreach (var line in reqLines)
                sb.Append("- ").Append(line).Append('\n');
            sb.Append('\n');
        }

        if (!string.IsNullOrWhiteSpace(skillTags))
            sb.Append("[Kỹ năng yêu cầu]\n").Append(skillTags.Trim()).Append('\n');

        return sb.ToString().Trim();
    }

    private static void Validate(string? name, decimal weight, decimal maxScore, string? criteriaType)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw Bad("Tên tiêu chí không được để trống.");
        if (weight <= 0)
            throw Bad("Trọng số (weight) phải > 0.");
        if (maxScore <= 0)
            throw Bad("Điểm tối đa (maxScore) phải > 0.");
        var type = (criteriaType ?? "").Trim().ToUpperInvariant();
        if (type != CriteriaType.Hard && type != CriteriaType.Soft)
            throw Bad($"criteriaType không hợp lệ: '{criteriaType}'. Hợp lệ: HARD, SOFT.");
    }

    private static string? NormalizeKeywords(string? keywords) =>
        string.IsNullOrWhiteSpace(keywords) ? null : keywords.Trim();

    private static CriteriaDto Map(EvaluationCriteria c) => new()
    {
        CriteriaId = c.CriteriaId,
        JobId = c.JobId,
        Name = c.Name,
        Weight = c.Weight,
        MaxScore = c.MaxScore,
        Active = c.Active,
        CriteriaType = c.CriteriaType,
        CvMatchable = c.CvMatchable,
        Keywords = c.Keywords,
        Status = c.Status,
        Source = c.Source
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
