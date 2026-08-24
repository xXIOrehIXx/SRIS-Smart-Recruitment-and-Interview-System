using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
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
    private readonly ICriteriaExtractionRepo _extractionRepo;
    private readonly IJobRepo _jobRepo;
    private readonly IApplicationRepo _applicationRepo;
    private readonly IApplicationStateService _stateService;
    private readonly ICriteriaExtractionClient _extractionClient;
    private readonly IContextData _contextData;
    private readonly ILogger _logger;

    public EvaluationCriteriaService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _criteriaRepo = serviceProvider.GetRequiredService<IEvaluationCriteriaRepo>();
        _extractionRepo = serviceProvider.GetRequiredService<ICriteriaExtractionRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _applicationRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _stateService = serviceProvider.GetRequiredService<IApplicationStateService>();
        _extractionClient = serviceProvider.GetRequiredService<ICriteriaExtractionClient>();
        _contextData = serviceProvider.GetRequiredService<IContextData>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<EvaluationCriteriaService>();
    }

    public async Task<CriteriaDto> CreateAsync(long companyId, long jobId, CriteriaInputDto dto)
    {
        await EnsureCanEditAsync(companyId, jobId);
        Validate(dto.Name, dto.Weight, dto.MaxScore);

        // UNIQUE (job_id, name): để DB chặn thì người dùng nhận 500 kèm nguyên văn lỗi SQL.
        // Chặn sớm để họ đọc được chuyện gì đang xảy ra.
        var name = dto.Name.Trim();
        var existed = await _criteriaRepo.GetByJobAsync(companyId, jobId,
            activeOnly: false, approvedOnly: false);
        if (existed.Any(c => string.Equals((c.Name ?? "").Trim(), name, StringComparison.OrdinalIgnoreCase)))
            throw Bad($"Vị trí này đã có tiêu chí \"{name}\".");

        var entity = new EvaluationCriteria
        {
            JobId = jobId,
            Name = dto.Name.Trim(),
            Weight = dto.Weight,
            MaxScore = dto.MaxScore,
            Active = true,
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
        Validate(dto.Name, dto.Weight, dto.MaxScore);

        var existing = await _criteriaRepo.GetByIdAsync(companyId, criteriaId)
            ?? throw NotFound($"Không tìm thấy tiêu chí (criteria_id={criteriaId}).");
        await EnsureCanEditAsync(companyId, existing.JobId);

        await _criteriaRepo.UpdateAsync(companyId, criteriaId, dto.Name.Trim(), dto.Weight, dto.MaxScore,
            dto.Active);

        existing.Name = dto.Name.Trim();
        existing.Weight = dto.Weight;
        existing.MaxScore = dto.MaxScore;
        existing.Active = dto.Active;
        return Map(existing);
    }

    public async Task<CriteriaExtractionStatusDto> RequestExtractAsync(long companyId, long jobId, long userId)
    {
        // Kiểm những thứ biết được NGAY (job có tồn tại không, có gì để bóc không) ở đây, đồng bộ,
        // để người dùng nhận lỗi tức thì thay vì xếp hàng rồi vài chục giây sau mới biết là vô ích.
        await EnsureCanEditAsync(companyId, jobId);

        var job = await _jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (job_id={jobId}).");
        var requirements = await _jobRepo.GetRequirementsAsync(companyId, jobId);

        if (string.IsNullOrWhiteSpace(BuildSourceText(job.JdText, requirements, job.SkillTags)))
            throw Bad("Tin tuyển dụng chưa có mô tả công việc, yêu cầu ứng viên hay kỹ năng nào để AI đọc.");

        var entry = await _extractionRepo.EnqueueAsync(companyId, jobId, userId);
        _logger.Information("RequestExtract: job={JobId} đã vào hàng đợi (extraction={Id}).",
            jobId, entry.ExtractionId);

        return MapStatus(entry);
    }

    public async Task<CriteriaExtractionStatusDto> GetExtractStatusAsync(long companyId, long jobId)
    {
        var entry = await _extractionRepo.GetByJobAsync(companyId, jobId);
        // Chưa bao giờ bóc job này -> NONE, không phải lỗi: FE chỉ cần biết "không có gì đang chạy".
        return entry is null
            ? new CriteriaExtractionStatusDto { JobId = jobId, Status = "NONE", Running = false }
            : MapStatus(entry);
    }

    public async Task RunExtractionAsync(long companyId, long jobId, long extractionId, CancellationToken ct = default)
    {
        // Chạy trong worker: KHÔNG được ném ra ngoài. Mọi kết cục — kể cả hỏng — phải nằm lại
        // trong dòng hàng đợi, vì đó là thứ duy nhất người dùng còn nhìn thấy được.
        try
        {
            var job = await _jobRepo.GetByIdAsync(companyId, jobId);
            if (job is null)
            {
                // Job bị xoá trong lúc lượt bóc còn xếp hàng. Phải LOG: nhánh này từng im lặng
                // hoàn toàn, nên khi nó bị đi vào oan (tenant chưa set -> query lọc company_id=0)
                // thì log không có một dòng nào giữa "bắt đầu bóc" và hết chuyện.
                _logger.Warning("RunExtraction: không đọc được job {JobId} của company {Co} — " +
                    "đánh dấu lượt bóc {Id} là FAILED.", jobId, companyId, extractionId);
                await CloseAsync(companyId, extractionId, jobId, ExtractionStatus.Failed,
                    null, ExtractionErrorCode.AiFailed, "Tin tuyển dụng không còn tồn tại.");
                return;
            }

            var requirements = await _jobRepo.GetRequirementsAsync(companyId, jobId);

            // AI phải đọc CẢ BA ô người dùng nhập, không riêng jd_text: "yêu cầu ứng viên" và
            // "kỹ năng" mới là chỗ chứa thứ bóc được thành tiêu chí, còn mô tả công việc thường
            // chỉ liệt kê đầu việc. Chỉ gửi jd_text = bỏ đúng phần dữ liệu giá trị nhất, rồi báo
            // người dùng "chưa nêu yêu cầu nào" trong khi họ đã nhập yêu cầu đầy đủ.
            var sourceText = BuildSourceText(job.JdText, requirements, job.SkillTags);

            IReadOnlyList<ExtractedCriterion> extracted;
            try
            {
                extracted = await _extractionClient.ExtractAsync(sourceText, ct);
            }
            catch (Exception ex)
            {
                _logger.Warning(ex, "RunExtraction: AI bóc tiêu chí thất bại (job={JobId}).", jobId);
                await CloseAsync(companyId, extractionId, jobId, ExtractionStatus.Failed, null,
                    ExtractionErrorCode.AiFailed,
                    "AI chưa đề xuất được tiêu chí — vui lòng thử lại, nhập thủ công hoặc áp template.");
                return;
            }

            // Tin tuyển dụng chỉ liệt kê đầu việc, không nêu yêu cầu nào với ứng viên -> AI trả rỗng.
            // Đây KHÔNG phải AI hỏng: báo đúng việc người dùng cần làm, và dừng TRƯỚC khi xoá draft cũ
            // để họ không mất bộ tiêu chí đang có chỉ vì bấm bóc lại. Thông báo phải chỉ đúng ô cần
            // sửa — AI đã đọc cả ba mục nên không được nói trống không là "bổ sung phần yêu cầu".
            if (extracted.Count == 0)
            {
                _logger.Information("RunExtraction: tin tuyển dụng không nêu yêu cầu nào (job={JobId}).", jobId);
                await CloseAsync(companyId, extractionId, jobId, ExtractionStatus.Failed, 0,
                    ExtractionErrorCode.NoRequirements,
                    "Tin tuyển dụng chưa nêu yêu cầu nào cần đánh giá khi phỏng vấn — mới chỉ có " +
                    "đầu việc, hoặc chỉ có những thứ đọc hồ sơ là biết (bằng cấp, chứng chỉ). " +
                    "Bổ sung mục \"Yêu cầu ứng viên\" hoặc \"Kỹ năng\" rồi bóc lại, hoặc tự nhập tiêu chí.");
                return;
            }

            // Bóc lại = thay trọn bộ DRAFT cũ (tiêu chí đã APPROVED giữ nguyên).
            await _criteriaRepo.DeleteDraftsAsync(companyId, jobId);

            // Bảng có UNIQUE (job_id, name). Tiêu chí đã DUYỆT (hoặc gõ tay, hoặc áp từ khuôn)
            // KHÔNG bị xoá ở trên, nên AI bóc lại mà trùng tên là INSERT ném lỗi -> cả lượt bóc
            // rơi vào catch chung và người dùng đọc được "AI chưa đề xuất được tiêu chí" trong
            // khi AI đã trả kết quả tốt. Đây chính là ca "lúc được lúc không": job mới thì chạy,
            // job từng duyệt tiêu chí rồi thì lần nào cũng hỏng.
            // Bỏ QUA dòng trùng chứ không xoá bản cũ: bản đã duyệt mới là bản đang dùng, và có
            // thể đã có phiếu chấm phỏng vấn trỏ vào nó.
            // CHỈ tính tiêu chí CÒN HIỆU LỰC là "đã có tên". Tiêu chí bị xoá là xoá MỀM
            // (active = 0) — coi tên của nó vẫn bị chiếm thì người dùng rơi vào ngõ cụt: xoá sạch
            // tiêu chí của tin tuyển dụng rồi bấm bóc lại, AI (temperature = 0) trả về đúng những
            // tên vừa xoá, tất cả bị bỏ qua, lượt bóc báo DONE với 0 tiêu chí và màn hình vẫn trống
            // — không có cách nào lấy lại bộ tiêu chí ngoài việc gõ tay từng dòng.
            // Ràng buộc DB cũng chỉ còn áp cho dòng active = 1 (xem V042), nên hai bên khớp nhau.
            var takenNames = (await _criteriaRepo.GetByJobAsync(companyId, jobId,
                    activeOnly: true, approvedOnly: false))
                .Select(c => (c.Name ?? "").Trim())
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var inserted = 0;
            var skipped = new List<string>();

            foreach (var c in extracted)
            {
                // Add trả false = trùng — bắt cả trùng với bản cũ lẫn trùng bên trong chính
                // lượt bóc (LLM thỉnh thoảng trả hai dòng y hệt nhau).
                if (!takenNames.Add(c.Name))
                {
                    skipped.Add(c.Name);
                    continue;
                }

                var entity = new EvaluationCriteria
                {
                    JobId = jobId,
                    Name = c.Name,
                    Weight = c.Weight,
                    MaxScore = 10,
                    Active = true,
                    Source = CriteriaSource.AiExtracted,
                    Status = CriteriaStatus.Draft
                };

                try
                {
                    entity.CriteriaId = await _criteriaRepo.InsertAsync(companyId, entity);
                    inserted++;
                }
                catch (Exception ex)
                {
                    // Lưới an toàn cho phần va chạm mà HashSet ở trên không thấy: collation của
                    // SQL Server có thể coi hai tên khác dấu là một, và người khác có thể vừa
                    // thêm tiêu chí cùng tên. Mất 1 dòng thì bỏ 1 dòng — đừng đánh đổ cả lượt bóc.
                    _logger.Warning(ex, "RunExtraction: bỏ qua tiêu chí \"{Name}\" (job={JobId}) — " +
                        "không chèn được.", c.Name, jobId);
                    skipped.Add(c.Name);
                }
            }

            if (skipped.Count > 0)
                _logger.Information("RunExtraction: job={JobId} bỏ {N} tiêu chí trùng tên đã có: [{Names}]",
                    jobId, skipped.Count, string.Join(" | ", skipped));

            await CloseAsync(companyId, extractionId, jobId, ExtractionStatus.Done,
                inserted, null, null);
            _logger.Information("RunExtraction: job={JobId} -> {N} tiêu chí DRAFT chờ duyệt.",
                jobId, inserted);
        }
        catch (Exception ex)
        {
            // Lỗi ngoài dự tính (DB trục trặc...) — vẫn phải đóng dòng, không để treo RUNNING.
            _logger.Error(ex, "RunExtraction: lỗi không mong đợi (job={JobId}, extraction={Id}).",
                jobId, extractionId);
            try
            {
                await CloseAsync(companyId, extractionId, jobId, ExtractionStatus.Failed, null,
                    ExtractionErrorCode.AiFailed,
                    "Đề xuất tiêu chí thất bại — vui lòng thử lại hoặc nhập tiêu chí thủ công.");
            }
            catch (Exception closeEx)
            {
                // Đóng cũng hỏng -> dòng còn RUNNING; worker sẽ thu hồi ở lần khởi động sau.
                _logger.Error(closeEx, "RunExtraction: không đóng nổi dòng hàng đợi {Id}.", extractionId);
            }
        }
    }

    /// <summary>
    /// Đóng dòng hàng đợi và KIỂM chuyện đó có xảy ra thật không. UPDATE khớp 0 dòng không ném
    /// lỗi, nên nếu không đếm thì "đã đóng" và "tưởng đã đóng" trông y hệt nhau — mà ca thứ hai
    /// để lại một lượt bóc treo RUNNING vĩnh viễn: FE hỏi trạng thái mãi vẫn thấy đang chạy.
    /// </summary>
    private async Task CloseAsync(long companyId, long extractionId, long jobId, string status,
        int? criteriaCount, string? errorCode, string? errorMessage)
    {
        var rows = await _extractionRepo.FinishAsync(companyId, extractionId, status,
            criteriaCount, errorCode, errorMessage);

        if (rows == 0)
            _logger.Error("RunExtraction: đóng lượt bóc {Id} (job={JobId}, company={Co}) sang {Status} " +
                "nhưng UPDATE không khớp dòng nào — lượt bóc đang treo RUNNING.",
                extractionId, jobId, companyId, status);
    }

    private static CriteriaExtractionStatusDto MapStatus(CriteriaExtraction e) => new()
    {
        JobId = e.JobId,
        Status = e.Status,
        Running = e.Status is ExtractionStatus.Pending or ExtractionStatus.Running,
        CriteriaCount = e.CriteriaCount,
        ErrorCode = e.ErrorCode,
        ErrorMessage = e.ErrorMessage,
        RequestedAt = e.RequestedAt,
        FinishedAt = e.FinishedAt
    };

    public async Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId)
    {
        await EnsureCanEditAsync(companyId, jobId);

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
        await EnsureCanEditAsync(companyId, existing.JobId);
        await _criteriaRepo.DeactivateAsync(companyId, existing.CriteriaId);
    }

    // ============================================================

    /// <summary>
    /// Trưởng bộ phận chỉ ra đề được cho vị trí mình phụ trách; nhân sự/Admin không bị chặn.
    /// Xem <see cref="JobCriteriaAccessGuard"/>.
    /// </summary>
    private Task EnsureCanEditAsync(long companyId, long jobId) =>
        JobCriteriaAccessGuard.EnsureCanEditAsync(_jobRepo, _contextData, companyId, jobId);

    /// <summary>
    /// Gộp mô tả công việc + yêu cầu ứng viên + kỹ năng thành 1 văn bản cho AI đọc — prompt bóc
    /// tiêu chí dựa vào ranh giới giữa các mục. Dùng chung với luồng sàng lọc CV
    /// (xem <see cref="JobSourceText"/>) để hai bên không đọc hai phiên bản khác nhau của cùng
    /// một tin tuyển dụng.
    /// </summary>
    private static string BuildSourceText(
        string? jdText, IReadOnlyList<JobRequirement> requirements, string? skillTags) =>
        JobSourceText.Build(jdText, requirements, skillTags);

    private static void Validate(string? name, decimal weight, decimal maxScore)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw Bad("Tên tiêu chí không được để trống.");
        if (weight <= 0)
            throw Bad("Trọng số (weight) phải > 0.");
        if (maxScore <= 0)
            throw Bad("Điểm tối đa (maxScore) phải > 0.");
    }

    private static CriteriaDto Map(EvaluationCriteria c) => new()
    {
        CriteriaId = c.CriteriaId,
        JobId = c.JobId,
        Name = c.Name,
        Weight = c.Weight,
        MaxScore = c.MaxScore,
        Active = c.Active,
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
