using System.Net;
using System.Text.Json;
using GP35.SRIS.Application.Contracts.Dtos.Business.Cv;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Ai;
using GP35.SRIS.Storage;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Sàng lọc CV theo JD bằng AI (V044) — chạy nền, kết quả lưu lại để mở sau đọc từ DB.
///
/// <para>
/// RANH GIỚI QUAN TRỌNG NHẤT: service này KHÔNG gọi <c>IApplicationStateService</c>, không
/// đổi <c>current_state</c>, không tự loại ai. Trường <c>decision</c> chỉ là chữ hiện trên
/// màn hình cho người tuyển dụng đọc. Ai định nối "REJECT -> tự chuyển hồ sơ sang REJECTED"
/// thì đọc lại đây trước: đó là quyết định nghiệp vụ của con người, không phải của model.
/// </para>
/// </summary>
public class CvScreeningService : BaseService<CvScreeningService>, ICvScreeningService
{
    /// <summary>
    /// Sàn ký tự để coi là "có CV đọc được". Khớp ngưỡng bên Python (100) — dưới mức này thì
    /// model không đối chiếu mà bịa ra một ứng viên rồi chấm điểm cho người đó.
    /// </summary>
    private const int MinCvTextLength = 100;

    /// <summary>camelCase cho JSON lưu trong DB — mở bảng ra đọc bằng mắt được.</summary>
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly ICvScreeningRepo _screeningRepo;
    private readonly IApplicationRepo _applicationRepo;
    private readonly ICvDocumentRepo _cvRepo;
    private readonly IJobRepo _jobRepo;
    private readonly ICvScreeningClient _screeningClient;
    private readonly IFileStorageService _fileStorage;
    private readonly IPdfTextExtractor _pdfExtractor;
    private readonly ILogger _logger;

    public CvScreeningService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _screeningRepo = serviceProvider.GetRequiredService<ICvScreeningRepo>();
        _applicationRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _cvRepo = serviceProvider.GetRequiredService<ICvDocumentRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _screeningClient = serviceProvider.GetRequiredService<ICvScreeningClient>();
        _fileStorage = serviceProvider.GetRequiredService<IFileStorageService>();
        _pdfExtractor = serviceProvider.GetRequiredService<IPdfTextExtractor>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CvScreeningService>();
    }

    public async Task<CvScreeningStatusDto> RequestScreeningAsync(long companyId, long applicationId, long userId)
    {
        var app = await _applicationRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        // Kiểm những thứ biết được NGAY, đồng bộ, để người dùng nhận lỗi tức thì thay vì xếp
        // hàng rồi vài chục giây sau mới biết là vô ích.
        if (string.IsNullOrWhiteSpace(await BuildJdTextAsync(companyId, app.JobId)))
            throw Bad("Tin tuyển dụng chưa có mô tả công việc, yêu cầu ứng viên hay kỹ năng nào để đối chiếu.");

        // Chỉ chặn khi KHÔNG có text VÀ KHÔNG có file gốc để bóc lại — còn file thì cứ cho chạy,
        // worker sẽ bóc lại từ file (xem GetCvTextAsync).
        var text = await _cvRepo.GetExtractedTextAsync(companyId, app.CvId);
        if ((text ?? "").Trim().Length < MinCvTextLength)
        {
            var file = await _cvRepo.GetFileInfoAsync(companyId, app.CvId);
            if (file is null || string.IsNullOrWhiteSpace(file.FileUrl))
                throw Bad("CV này không có nội dung chữ để AI đọc (bản scan ảnh hoặc thiếu file gốc).");
        }

        var entry = await _screeningRepo.EnqueueAsync(companyId, applicationId, app.JobId, app.CvId, userId);
        _logger.Information("RequestScreening: hồ sơ={AppId} đã vào hàng đợi (screening={Id}).",
            applicationId, entry.ScreeningId);

        return MapStatus(entry);
    }

    public async Task<JobScreeningQueueDto> RequestJobScreeningAsync(
        long companyId, long jobId, long userId, bool rescreenDone = false)
    {
        // JD rỗng thì cả lượt chạy là vô ích — kiểm MỘT lần ở đây thay vì để worker phát hiện
        // lại trên từng hồ sơ rồi ghi cùng một dòng lỗi vào N card.
        if (string.IsNullOrWhiteSpace(await BuildJdTextAsync(companyId, jobId)))
            throw Bad("Tin tuyển dụng chưa có mô tả công việc, yêu cầu ứng viên hay kỹ năng nào để đối chiếu.");

        // Chỉ hồ sơ còn ở vòng sàng lọc. Chấm lại người đã phỏng vấn xong hay đã bị loại không
        // giúp ai xếp thứ tự, chỉ tốn lượt chạy LLM.
        var rows = (await _applicationRepo.GetBoardByJobAsync(companyId, jobId))
            .Where(r => r.CurrentState is ApplicationState.New or ApplicationState.Screening)
            .ToList();

        var result = new JobScreeningQueueDto { JobId = jobId, TotalCandidates = rows.Count };

        foreach (var row in rows)
        {
            // Đang xếp hàng/đang chạy -> để yên. EnqueueAsync sẽ reset dòng về PENDING, tức là
            // cướp lại một lượt worker có khi đang chạy dở giữa chừng.
            if (row.ScreeningStatus is ScreeningStatus.Pending or ScreeningStatus.Running)
            {
                result.SkippedRunning++;
                continue;
            }

            if (!rescreenDone && row.ScreeningStatus == ScreeningStatus.Done)
            {
                result.SkippedDone++;
                continue;
            }

            await _screeningRepo.EnqueueAsync(companyId, row.ApplicationId, jobId, row.CvId, userId);
            result.Queued++;
        }

        _logger.Information(
            "RequestJobScreening: vị trí={JobId} xếp hàng {Queued}/{Total} hồ sơ " +
            "(bỏ qua {Done} đã có kết quả, {Running} đang chạy).",
            jobId, result.Queued, result.TotalCandidates, result.SkippedDone, result.SkippedRunning);

        return result;
    }

    public async Task<CvScreeningStatusDto> GetStatusAsync(long companyId, long applicationId)
    {
        var entry = await _screeningRepo.GetByApplicationAsync(companyId, applicationId);
        // Chưa bao giờ phân tích hồ sơ này -> NONE, không phải lỗi: FE chỉ cần biết
        // "không có gì đang chạy và cũng chưa có kết quả".
        return entry is null
            ? new CvScreeningStatusDto { ApplicationId = applicationId, Status = "NONE", Running = false }
            : MapStatus(entry);
    }

    public async Task RunScreeningAsync(
        long companyId, long applicationId, long screeningId, CancellationToken ct = default)
    {
        // Chạy trong worker: KHÔNG được ném ra ngoài. Mọi kết cục — kể cả hỏng — phải nằm lại
        // trong dòng hàng đợi, vì đó là thứ duy nhất người dùng còn nhìn thấy được.
        try
        {
            var app = await _applicationRepo.GetByIdAsync(companyId, applicationId);
            if (app is null)
            {
                // Hồ sơ bị xoá trong lúc lượt sàng lọc còn xếp hàng.
                _logger.Warning("RunScreening: không đọc được hồ sơ {AppId} của company {Co} — " +
                    "đánh dấu lượt {Id} là FAILED.", applicationId, companyId, screeningId);
                await CloseAsync(companyId, screeningId, applicationId, ScreeningStatus.Failed, null,
                    ScreeningErrorCode.AiFailed, "Hồ sơ không còn tồn tại.");
                return;
            }

            var jdText = await BuildJdTextAsync(companyId, app.JobId);
            if (string.IsNullOrWhiteSpace(jdText))
            {
                await CloseAsync(companyId, screeningId, applicationId, ScreeningStatus.Failed, null,
                    ScreeningErrorCode.JdEmpty,
                    "Tin tuyển dụng chưa có mô tả công việc, yêu cầu ứng viên hay kỹ năng nào để " +
                    "đối chiếu — bổ sung rồi phân tích lại.");
                return;
            }

            var cvText = await GetCvTextAsync(companyId, app.CvId, ct);
            if (cvText.Trim().Length < MinCvTextLength)
            {
                await CloseAsync(companyId, screeningId, applicationId, ScreeningStatus.Failed, null,
                    ScreeningErrorCode.CvNoText,
                    "CV này không có nội dung chữ để AI đọc — thường là bản scan ảnh. " +
                    "Đề nghị ứng viên gửi lại CV dạng PDF có chữ.");
                return;
            }

            CvScreeningResult result;
            try
            {
                result = await _screeningClient.ScreenAsync(cvText, jdText, ct);
            }
            catch (Exception ex)
            {
                _logger.Warning(ex, "RunScreening: AI sàng lọc thất bại (hồ sơ={AppId}).", applicationId);
                await CloseAsync(companyId, screeningId, applicationId, ScreeningStatus.Failed, null,
                    ScreeningErrorCode.AiFailed,
                    "AI chưa phân tích được CV này — vui lòng thử lại sau, hoặc mở CV đọc trực tiếp.");
                return;
            }

            var outcome = new ScreeningOutcome(
                result.Summary,
                JsonSerializer.Serialize(
                    result.Matched.Select(m => new MatchedRequirementDto
                    {
                        Requirement = m.Requirement,
                        Evidence = m.Evidence
                    }), JsonOpts),
                JsonSerializer.Serialize(result.Missing, JsonOpts),
                result.FitScore,
                result.Decision,
                result.DecisionReason);

            await CloseAsync(companyId, screeningId, applicationId, ScreeningStatus.Done, outcome, null, null);
            _logger.Information(
                "RunScreening: hồ sơ={AppId} -> {Decision} ({Score}/100), đạt {Matched} / thiếu {Missing}.",
                applicationId, result.Decision, result.FitScore, result.Matched.Count, result.Missing.Count);
        }
        catch (Exception ex)
        {
            // Lỗi ngoài dự tính (DB trục trặc...) — vẫn phải đóng dòng, không để treo RUNNING.
            _logger.Error(ex, "RunScreening: lỗi không mong đợi (hồ sơ={AppId}, screening={Id}).",
                applicationId, screeningId);
            try
            {
                await CloseAsync(companyId, screeningId, applicationId, ScreeningStatus.Failed, null,
                    ScreeningErrorCode.AiFailed, "Phân tích CV thất bại — vui lòng thử lại.");
            }
            catch (Exception closeEx)
            {
                // Đóng cũng hỏng -> dòng còn RUNNING; worker sẽ thu hồi ở lần khởi động sau.
                _logger.Error(closeEx, "RunScreening: không đóng nổi dòng hàng đợi {Id}.", screeningId);
            }
        }
    }

    // ============================================================

    /// <summary>
    /// Text CV để đưa cho AI. Ưu tiên BÓC LẠI từ file gốc thay vì dùng thẳng cột
    /// <c>extracted_text</c> đang có.
    ///
    /// <para>
    /// Vì sao phải bóc lại: mọi CV nhận trước bản này được bóc bằng <c>PdfTextExtractor</c> cũ,
    /// vốn cố ý vứt thứ tự chữ (khi đó text chỉ dùng cho embedding). Đưa nguyên văn bản cài răng
    /// lược đó cho LLM thì kết quả sai một cách rất thuyết phục — model vẫn trả JSON đẹp, chỉ là
    /// đọc tiêu đề mục thành tên công ty. Bóc lại rồi ghi đè luôn xuống DB: mỗi CV chỉ phải trả
    /// giá một lần, và lần phân tích sau đọc thẳng bản đã sửa.
    /// </para>
    ///
    /// <para>Không tải được file (storage lỗi, CV cũ không có file gốc) -> lùi về text đang lưu.</para>
    /// </summary>
    private async Task<string> GetCvTextAsync(long companyId, long cvId, CancellationToken ct)
    {
        var stored = (await _cvRepo.GetExtractedTextAsync(companyId, cvId) ?? "").Trim();

        try
        {
            var info = await _cvRepo.GetFileInfoAsync(companyId, cvId);
            if (info is null || string.IsNullOrWhiteSpace(info.FileUrl))
                return stored;

            var file = await _fileStorage.DownloadAsync(info.FileUrl, ct);
            if (file is null)
                return stored;

            var extract = _pdfExtractor.Extract(file.Value.Content);
            var fresh = extract.Text.Trim();

            // Bản bóc lại tệ hơn hẳn bản đang lưu thì giữ bản cũ. Xảy ra khi phân tích bố cục
            // rơi vào nhánh dự phòng trên một PDF dựng lạ — đừng đánh đổi dữ liệu đang dùng được
            // lấy một lần thử.
            if (extract.Kind != PdfKind.HasText || fresh.Length < stored.Length / 2)
                return stored;

            if (fresh != stored)
                await _cvRepo.UpdateExtractedTextAsync(companyId, cvId, fresh);

            return fresh;
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "RunScreening: bóc lại text từ file CV {CvId} thất bại — " +
                "dùng text đang lưu.", cvId);
            return stored;
        }
    }

    private async Task<string> BuildJdTextAsync(long companyId, long jobId)
    {
        var job = await _jobRepo.GetByIdAsync(companyId, jobId);
        if (job is null) return string.Empty;

        var requirements = await _jobRepo.GetRequirementsAsync(companyId, jobId);
        return JobSourceText.Build(job.JdText, requirements, job.SkillTags);
    }

    /// <summary>
    /// Đóng dòng hàng đợi và KIỂM chuyện đó có xảy ra thật không. UPDATE khớp 0 dòng không ném
    /// lỗi, nên nếu không đếm thì "đã đóng" và "tưởng đã đóng" trông y hệt nhau — mà ca thứ hai
    /// để lại một lượt treo RUNNING vĩnh viễn: FE hỏi trạng thái mãi vẫn thấy đang chạy.
    /// </summary>
    private async Task CloseAsync(long companyId, long screeningId, long applicationId, string status,
        ScreeningOutcome? outcome, string? errorCode, string? errorMessage)
    {
        var rows = await _screeningRepo.FinishAsync(companyId, screeningId, status, outcome, errorCode, errorMessage);

        if (rows == 0)
            _logger.Error("RunScreening: đóng lượt {Id} (hồ sơ={AppId}, company={Co}) sang {Status} " +
                "nhưng UPDATE không khớp dòng nào — lượt sàng lọc đang treo RUNNING.",
                screeningId, applicationId, companyId, status);
    }

    private static CvScreeningStatusDto MapStatus(CvScreening e) => new()
    {
        ApplicationId = e.ApplicationId,
        Status = e.Status,
        Running = e.Status is ScreeningStatus.Pending or ScreeningStatus.Running,
        ErrorCode = e.ErrorCode,
        ErrorMessage = e.ErrorMessage,
        Result = MapResult(e),
        RequestedAt = e.RequestedAt,
        FinishedAt = e.FinishedAt
    };

    /// <summary>
    /// Kết quả chỉ trả về khi lượt đã DONE. JSON hỏng (đổi schema giữa chừng, sửa tay trong DB)
    /// -> trả null thay vì ném: hỏng phần hiển thị kết quả cũ không được làm chết cả màn hình
    /// chi tiết ứng viên.
    /// </summary>
    private static CvScreeningResultDto? MapResult(CvScreening e)
    {
        if (e.Status != ScreeningStatus.Done || string.IsNullOrWhiteSpace(e.Summary))
            return null;

        try
        {
            return new CvScreeningResultDto
            {
                Summary = e.Summary,
                Matched = string.IsNullOrWhiteSpace(e.MatchedJson)
                    ? []
                    : JsonSerializer.Deserialize<List<MatchedRequirementDto>>(e.MatchedJson, JsonOpts) ?? [],
                Missing = string.IsNullOrWhiteSpace(e.MissingJson)
                    ? []
                    : JsonSerializer.Deserialize<List<string>>(e.MissingJson, JsonOpts) ?? [],
                FitScore = e.FitScore ?? 0,
                Decision = e.Decision ?? ScreeningDecision.Consider,
                DecisionReason = e.DecisionReason ?? ""
            };
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
