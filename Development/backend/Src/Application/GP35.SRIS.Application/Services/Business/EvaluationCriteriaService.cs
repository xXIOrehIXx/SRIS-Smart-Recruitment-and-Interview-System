using System.Net;
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
    private readonly ICriteriaExtractionClient _extractionClient;
    private readonly ILogger _logger;

    public EvaluationCriteriaService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _criteriaRepo = serviceProvider.GetRequiredService<IEvaluationCriteriaRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
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
        var jobInfo = await _jobRepo.GetEmbeddingInfoAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (job_id={jobId}).");
        if (string.IsNullOrWhiteSpace(jobInfo.JdText))
            throw Bad("Job chưa có mô tả công việc (jd_text) để bóc tiêu chí.");

        IReadOnlyList<ExtractedCriterion> extracted;
        try
        {
            extracted = await _extractionClient.ExtractAsync(jobInfo.JdText);
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
        return approved;
    }

    public async Task DeactivateAsync(long companyId, long criteriaId)
    {
        var existing = await _criteriaRepo.GetByIdAsync(companyId, criteriaId)
            ?? throw NotFound($"Không tìm thấy tiêu chí (criteria_id={criteriaId}).");
        await _criteriaRepo.DeactivateAsync(companyId, existing.CriteriaId);
    }

    // ============================================================

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
