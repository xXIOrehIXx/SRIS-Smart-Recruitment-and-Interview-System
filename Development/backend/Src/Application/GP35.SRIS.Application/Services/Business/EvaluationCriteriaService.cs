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
/// Tiêu chí đánh giá (5.7, 5.18): CRUD + AI bóc DRAFT + người duyệt chốt.
///
/// <para><b>Hai chỗ neo (V056).</b> Bộ tiêu chí bắt đầu ở <b>Yêu cầu tuyển dụng</b> — Trưởng bộ
/// phận vừa mô tả vị trí vừa ra đề, cùng một lúc trên cùng một văn bản — rồi CHUYỂN sang job khi
/// nhân sự tạo tin từ yêu cầu đã duyệt. Tiêu chí sửa thẳng trên job (đường cũ) vẫn chạy nguyên.
/// Chọn cửa quyền theo chỗ dòng đang neo vào: <see cref="EnsureCanEditCriterionAsync"/>.</para>
/// </summary>
public class EvaluationCriteriaService : BaseService<EvaluationCriteriaService>, IEvaluationCriteriaService
{
    private readonly IEvaluationCriteriaRepo _criteriaRepo;
    private readonly ICriteriaExtractionRepo _extractionRepo;
    private readonly IJobRepo _jobRepo;
    private readonly IRecruitmentRequestRepo _requestRepo;
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
        _requestRepo = serviceProvider.GetRequiredService<IRecruitmentRequestRepo>();
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

    // ================= V056: bộ tiêu chí trên YÊU CẦU TUYỂN DỤNG =================
    // Job chưa tồn tại nên mọi thứ ở khối này neo vào request_id. Cửa quyền là chủ của yêu cầu
    // (JobCriteriaAccessGuard.EnsureCanEditRequestCriteriaAsync), và KHÔNG có bước PENDING —
    // ở đường này người ra đề cũng chính là người duyệt.

    public async Task<IReadOnlyList<CriteriaDto>> GetByRequestAsync(
        long companyId, long requestId, bool includeInactive = false)
    {
        // ĐỌC để mở như bên job: Giám đốc cần nhìn bộ tiêu chí khi duyệt yêu cầu, nhân sự cần
        // nhìn trước khi tạo tin. Chặn ghi là đủ.
        var list = await _criteriaRepo.GetByRequestAsync(companyId, requestId,
            activeOnly: !includeInactive, approvedOnly: false);
        return list.Select(Map).ToList();
    }

    public async Task<CriteriaDto> CreateForRequestAsync(long companyId, long requestId, CriteriaInputDto dto)
    {
        await EnsureCanEditRequestAsync(companyId, requestId);
        Validate(dto.Name, dto.Weight, dto.MaxScore);

        var name = dto.Name.Trim();
        var existed = await _criteriaRepo.GetByRequestAsync(companyId, requestId,
            activeOnly: false, approvedOnly: false);
        if (existed.Any(c => string.Equals((c.Name ?? "").Trim(), name, StringComparison.OrdinalIgnoreCase)))
            throw Bad($"Yêu cầu tuyển dụng này đã có tiêu chí \"{name}\".");

        var entity = new EvaluationCriteria
        {
            RequestId = requestId,
            Name = name,
            Weight = dto.Weight,
            MaxScore = dto.MaxScore,
            Active = true,
            // Người gõ trực tiếp = tự ra đề cho mình -> APPROVED luôn, như bên job.
            Source = CriteriaSource.Manual,
            Status = CriteriaStatus.Approved
        };
        entity.CriteriaId = await _criteriaRepo.InsertAsync(companyId, entity);
        return Map(entity);
    }

    public async Task<CriteriaExtractionStatusDto> RequestExtractForRequestAsync(
        long companyId, long requestId, long userId)
    {
        await EnsureCanEditRequestAsync(companyId, requestId);

        var request = await _requestRepo.GetByIdAsync(companyId, requestId)
            ?? throw NotFound($"Không tìm thấy yêu cầu tuyển dụng (request_id={requestId}).");

        // Kiểm ngay tại đây thay vì để worker phát hiện: người dùng biết liền là phải nhập thêm,
        // thay vì chờ vài chục giây rồi mới nhận một dòng FAILED.
        if (string.IsNullOrWhiteSpace(JobSourceText.BuildFromRequest(request.Description, request.Requirements)))
            throw Bad("Yêu cầu tuyển dụng chưa có mô tả công việc hay yêu cầu ứng viên nào để AI đọc.");

        var entry = await _extractionRepo.EnqueueForRequestAsync(companyId, requestId, userId);
        _logger.Information("RequestExtract: request={RequestId} đã vào hàng đợi (extraction={Id}).",
            requestId, entry.ExtractionId);

        return MapStatus(entry);
    }

    public async Task<CriteriaExtractionStatusDto> GetExtractStatusForRequestAsync(long companyId, long requestId)
    {
        var entry = await _extractionRepo.GetByRequestAsync(companyId, requestId);
        return entry is null
            ? new CriteriaExtractionStatusDto { RequestId = requestId, Status = "NONE", Running = false }
            : MapStatus(entry);
    }

    public async Task<int> ApproveForRequestAsync(long companyId, long requestId, long userId)
    {
        await EnsureCanEditRequestAsync(companyId, requestId);

        var approved = await _criteriaRepo.ApproveForRequestAsync(companyId, requestId, userId);
        if (approved == 0)
            throw Bad("Yêu cầu tuyển dụng này không có tiêu chí nào đang chờ chốt.");

        _logger.Information("ApproveRequestCriteria: user={UserId} chốt {N} tiêu chí của request={RequestId}.",
            userId, approved, requestId);
        return approved;
    }

    public async Task<int> AttachRequestCriteriaToJobAsync(long companyId, long requestId, long jobId)
    {
        // KHÔNG gác quyền ở đây: hàm này chạy bên trong lượt tạo tin tuyển dụng, mà cửa đó đã
        // gác rồi (chỉ nhân sự/Admin tạo được tin). Gác thêm lần nữa theo chủ sở hữu yêu cầu là
        // chặn đúng người đang làm đúng việc — nhân sự không phải người tạo yêu cầu.
        var moved = await _criteriaRepo.MoveToJobAsync(companyId, requestId, jobId);

        _logger.Information("AttachRequestCriteria: chuyển {N} tiêu chí từ request={RequestId} sang job={JobId}.",
            moved, requestId, jobId);
        return moved;
    }

    private Task EnsureCanEditRequestAsync(long companyId, long requestId) =>
        JobCriteriaAccessGuard.EnsureCanEditRequestCriteriaAsync(
            _requestRepo, _contextData, companyId, requestId);

    // ================= hết khối V056 =================

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
        await EnsureCanEditCriterionAsync(companyId, existing);
        EnsureNotUnderReview(existing);

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

    public async Task RunExtractionAsync(long companyId, long? jobId, long? requestId,
        long extractionId, CancellationToken ct = default)
    {
        // "job=15" hay "request=4" — mọi dòng log của lượt này dùng chung nhãn, để đọc log không
        // phải đoán lượt bóc đang chạy trên đường nào.
        var nguon = jobId is long jl ? $"job={jl}" : $"request={requestId}";

        // Chạy trong worker: KHÔNG được ném ra ngoài. Mọi kết cục — kể cả hỏng — phải nằm lại
        // trong dòng hàng đợi, vì đó là thứ duy nhất người dùng còn nhìn thấy được.
        try
        {
            // Gom nội dung cho AI đọc — từ tin tuyển dụng, hoặc từ yêu cầu tuyển dụng (V056).
            string sourceText;
            if (jobId is long jid)
            {
                var job = await _jobRepo.GetByIdAsync(companyId, jid);
                if (job is null)
                {
                    // Job bị xoá trong lúc lượt bóc còn xếp hàng. Phải LOG: nhánh này từng im lặng
                    // hoàn toàn, nên khi nó bị đi vào oan (tenant chưa set -> query lọc company_id=0)
                    // thì log không có một dòng nào giữa "bắt đầu bóc" và hết chuyện.
                    _logger.Warning("RunExtraction: không đọc được {Nguon} của company {Co} — " +
                        "đánh dấu lượt bóc {Id} là FAILED.", nguon, companyId, extractionId);
                    await CloseAsync(companyId, extractionId, nguon, ExtractionStatus.Failed,
                        null, ExtractionErrorCode.AiFailed, "Tin tuyển dụng không còn tồn tại.");
                    return;
                }

                // AI phải đọc CẢ BA ô người dùng nhập, không riêng jd_text (xem JobSourceText).
                sourceText = BuildSourceText(job.JdText,
                    await _jobRepo.GetRequirementsAsync(companyId, jid), job.SkillTags);
            }
            else
            {
                var request = await _requestRepo.GetByIdAsync(companyId, requestId!.Value);
                if (request is null)
                {
                    _logger.Warning("RunExtraction: không đọc được {Nguon} của company {Co} — " +
                        "đánh dấu lượt bóc {Id} là FAILED.", nguon, companyId, extractionId);
                    await CloseAsync(companyId, extractionId, nguon, ExtractionStatus.Failed,
                        null, ExtractionErrorCode.AiFailed, "Yêu cầu tuyển dụng không còn tồn tại.");
                    return;
                }

                sourceText = JobSourceText.BuildFromRequest(request.Description, request.Requirements);
            }

            IReadOnlyList<ExtractedCriterion> extracted;
            try
            {
                extracted = await _extractionClient.ExtractAsync(sourceText, ct);
            }
            catch (Exception ex)
            {
                _logger.Warning(ex, "RunExtraction: AI bóc tiêu chí thất bại ({Nguon}).", nguon);
                await CloseAsync(companyId, extractionId, nguon, ExtractionStatus.Failed, null,
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
                _logger.Information("RunExtraction: nguồn không nêu yêu cầu nào ({Nguon}).", nguon);
                await CloseAsync(companyId, extractionId, nguon, ExtractionStatus.Failed, 0,
                    ExtractionErrorCode.NoRequirements,
                    "Tin tuyển dụng chưa nêu yêu cầu nào cần đánh giá khi phỏng vấn — mới chỉ có " +
                    "đầu việc, hoặc chỉ có những thứ đọc hồ sơ là biết (bằng cấp, chứng chỉ). " +
                    "Bổ sung mục \"Yêu cầu ứng viên\" hoặc \"Kỹ năng\" rồi bóc lại, hoặc tự nhập tiêu chí.");
                return;
            }

            // Bóc lại = thay trọn bộ DRAFT cũ (tiêu chí đã APPROVED giữ nguyên).
            if (jobId is long jd)
                await _criteriaRepo.DeleteDraftsAsync(companyId, jd);
            else
                await _criteriaRepo.DeleteDraftsByRequestAsync(companyId, requestId!.Value);

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
            var daCo = jobId is long jt
                ? await _criteriaRepo.GetByJobAsync(companyId, jt, activeOnly: true, approvedOnly: false)
                : await _criteriaRepo.GetByRequestAsync(companyId, requestId!.Value,
                        activeOnly: true, approvedOnly: false);

            var takenNames = daCo
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
                    RequestId = requestId,
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
                    _logger.Warning(ex, "RunExtraction: bỏ qua tiêu chí \"{Name}\" ({Nguon}) — " +
                        "không chèn được.", c.Name, nguon);
                    skipped.Add(c.Name);
                }
            }

            if (skipped.Count > 0)
                _logger.Information("RunExtraction: {Nguon} bỏ {N} tiêu chí trùng tên đã có: [{Names}]",
                    nguon, skipped.Count, string.Join(" | ", skipped));

            await CloseAsync(companyId, extractionId, nguon, ExtractionStatus.Done,
                inserted, null, null);
            _logger.Information("RunExtraction: {Nguon} -> {N} tiêu chí DRAFT chờ duyệt.",
                nguon, inserted);
        }
        catch (Exception ex)
        {
            // Lỗi ngoài dự tính (DB trục trặc...) — vẫn phải đóng dòng, không để treo RUNNING.
            _logger.Error(ex, "RunExtraction: lỗi không mong đợi ({Nguon}, extraction={Id}).",
                nguon, extractionId);
            try
            {
                await CloseAsync(companyId, extractionId, nguon, ExtractionStatus.Failed, null,
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
    private async Task CloseAsync(long companyId, long extractionId, string nguon, string status,
        int? criteriaCount, string? errorCode, string? errorMessage)
    {
        var rows = await _extractionRepo.FinishAsync(companyId, extractionId, status,
            criteriaCount, errorCode, errorMessage);

        if (rows == 0)
            _logger.Error("RunExtraction: đóng lượt bóc {Id} ({Nguon}, company={Co}) sang {Status} " +
                "nhưng UPDATE không khớp dòng nào — lượt bóc đang treo RUNNING.",
                extractionId, nguon, companyId, status);
    }

    private static CriteriaExtractionStatusDto MapStatus(CriteriaExtraction e) => new()
    {
        JobId = e.JobId,
        RequestId = e.RequestId,
        Status = e.Status,
        Running = e.Status is ExtractionStatus.Pending or ExtractionStatus.Running,
        CriteriaCount = e.CriteriaCount,
        ErrorCode = e.ErrorCode,
        ErrorMessage = e.ErrorMessage,
        RequestedAt = e.RequestedAt,
        FinishedAt = e.FinishedAt
    };

    public async Task<int> SubmitForReviewAsync(long companyId, long jobId, long userId)
    {
        await EnsureCanEditAsync(companyId, jobId);

        var submitted = await _criteriaRepo.SubmitDraftsAsync(companyId, jobId, userId);
        if (submitted == 0)
            throw Bad("Vị trí này không có tiêu chí nháp nào để gửi duyệt.");

        _logger.Information("SubmitCriteria: user={UserId} gửi {N} tiêu chí của job={JobId} cho Trưởng bộ phận duyệt.",
            userId, submitted, jobId);

        return submitted;
    }

    public async Task<int> RequestChangesAsync(long companyId, long jobId, long userId, string? note)
    {
        // Người trả về phải là người duyệt được — trả về cũng là một quyết định trên bộ tiêu chí.
        await EnsureCanApproveAsync(companyId, jobId);

        note = note?.Trim();
        if (string.IsNullOrWhiteSpace(note))
            throw Bad("Hãy ghi rõ cần sửa gì trước khi trả bộ tiêu chí về — " +
                      "trả về mà không nói lý do thì người soạn chỉ biết gửi lại y nguyên.");

        var returned = await _criteriaRepo.RequestChangesAsync(companyId, jobId, userId, note!);
        if (returned == 0)
            throw Bad("Vị trí này không có bộ tiêu chí nào đang chờ duyệt.");

        _logger.Information("RequestChanges: user={UserId} trả {N} tiêu chí của job={JobId} về nháp.",
            userId, returned, jobId);

        return returned;
    }

    public async Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId)
    {
        // V055: cửa DUYỆT là của Trưởng bộ phận, KHÔNG phải của người soạn.
        await EnsureCanApproveAsync(companyId, jobId);

        var approved = await _criteriaRepo.ApprovePendingAsync(companyId, jobId, userId);
        if (approved == 0)
            throw Bad("Vị trí này không có bộ tiêu chí nào đang chờ duyệt. " +
                      "Người soạn phải bấm \"Gửi Trưởng bộ phận duyệt\" trước.");

        _logger.Information("ApproveCriteria: user={UserId} duyệt {N} tiêu chí của job={JobId}.",
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
        await EnsureCanEditCriterionAsync(companyId, existing);
        EnsureNotUnderReview(existing);
        await _criteriaRepo.DeactivateAsync(companyId, existing.CriteriaId);
    }

    // ============================================================

    /// <summary>
    /// Trưởng bộ phận chỉ ra đề được cho vị trí mình phụ trách; nhân sự/Admin không bị chặn.
    /// Xem <see cref="JobCriteriaAccessGuard"/>.
    /// </summary>
    private Task EnsureCanEditAsync(long companyId, long jobId) =>
        JobCriteriaAccessGuard.EnsureCanEditAsync(_jobRepo, _contextData, companyId, jobId);

    /// <summary>Cửa DUYỆT — chỉ Trưởng bộ phận của vị trí đó (Admin bypass). Xem <see cref="JobCriteriaAccessGuard"/>.</summary>
    private Task EnsureCanApproveAsync(long companyId, long jobId) =>
        JobCriteriaAccessGuard.EnsureCanApproveAsync(_jobRepo, _contextData, companyId, jobId);

    /// <summary>
    /// Cửa SOẠN cho MỘT dòng tiêu chí — nó có thể đang nằm ở job, hoặc còn ở Yêu cầu tuyển dụng
    /// (V056). Chọn cửa theo chỗ dòng đó đang neo vào, không đoán theo role.
    /// </summary>
    private Task EnsureCanEditCriterionAsync(long companyId, EvaluationCriteria c)
    {
        if (c.JobId is long jobId)
            return EnsureCanEditAsync(companyId, jobId);

        if (c.RequestId is long requestId)
            return JobCriteriaAccessGuard.EnsureCanEditRequestCriteriaAsync(
                _requestRepo, _contextData, companyId, requestId);

        // CK_Crit_job_or_request (V056) chặn ở tầng DB nên nhánh này chỉ tới được nếu ràng buộc
        // bị gỡ. Chặn thay vì cho qua: không biết ai sở hữu thì không ai được sửa.
        throw Bad($"Tiêu chí {c.CriteriaId} không gắn với tin tuyển dụng lẫn yêu cầu tuyển dụng nào.");
    }

    /// <summary>
    /// Bộ tiêu chí đã gửi đi thì KHOÁ SỬA cho tới khi Trưởng bộ phận trả lời. Không khoá thì họ
    /// duyệt một bản đang chạy: bấm duyệt lúc 10h00 mà nội dung đã khác bản họ đọc lúc 9h55.
    /// Muốn sửa tiếp thì nhờ họ bấm "Yêu cầu chỉnh sửa" để bộ tiêu chí về lại nháp.
    /// </summary>
    private static void EnsureNotUnderReview(EvaluationCriteria c)
    {
        if (string.Equals(c.Status, CriteriaStatus.Pending, StringComparison.OrdinalIgnoreCase))
            throw Bad("Bộ tiêu chí đang chờ Trưởng bộ phận duyệt nên tạm khoá sửa. " +
                      "Nhờ họ bấm \"Yêu cầu chỉnh sửa\" để trả về nháp nếu cần sửa tiếp.");
    }

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
        RequestId = c.RequestId,
        Name = c.Name,
        Weight = c.Weight,
        MaxScore = c.MaxScore,
        Active = c.Active,
        Status = c.Status,
        Source = c.Source,
        SubmittedAt = c.SubmittedAt,
        ReviewedAt = c.ReviewedAt,
        ReviewNote = c.ReviewNote
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
