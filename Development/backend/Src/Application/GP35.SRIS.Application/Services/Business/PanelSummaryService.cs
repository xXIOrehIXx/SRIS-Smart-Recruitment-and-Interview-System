using System.Net;
using System.Text.Json;
using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Ai;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// AI tổng hợp ý kiến hội đồng phỏng vấn (V047) — chạy nền, kết quả lưu lại.
///
/// <para>
/// RANH GIỚI (giống <see cref="CvScreeningService"/>): không gọi <c>IApplicationStateService</c>,
/// không đụng <c>current_state</c>, và bản tổng hợp không chứa kết luận tuyển/không tuyển.
/// AI ở đây làm đúng một việc: đọc hộ 3-5 phiếu chấm dài rồi chỉ ra hội đồng đồng ý ở đâu,
/// lệch nhau ở đâu. Quyền quyết vẫn của Giám đốc (V043).
/// </para>
///
/// <para>
/// Nguồn dữ liệu là <c>GetDecisionBriefAsync</c> — dùng lại đúng thứ màn quyết định đang hiện,
/// nên AI không bao giờ đọc được nhiều hơn người dùng. Quan trọng với BLIND REVIEW (5.7):
/// brief chỉ chứa phiếu đã SUBMITTED, nháp của người khác không lọt vào prompt.
/// </para>
/// </summary>
public class PanelSummaryService : BaseService<PanelSummaryService>, IPanelSummaryService
{
    /// <summary>camelCase cho JSON lưu trong DB — mở bảng ra đọc bằng mắt được.</summary>
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly IPanelSummaryRepo _summaryRepo;
    private readonly IApplicationRepo _applicationRepo;
    private readonly IInterviewScoringService _scoringService;
    private readonly IPanelSummaryClient _summaryClient;
    private readonly ILogger _logger;

    public PanelSummaryService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _summaryRepo = serviceProvider.GetRequiredService<IPanelSummaryRepo>();
        _applicationRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _scoringService = serviceProvider.GetRequiredService<IInterviewScoringService>();
        _summaryClient = serviceProvider.GetRequiredService<IPanelSummaryClient>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<PanelSummaryService>();
    }

    public async Task<PanelSummaryStatusDto> RequestSummaryAsync(
        long companyId, long applicationId, long userId)
    {
        _ = await _applicationRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        // Chưa ai nộp phiếu thì chặn NGAY, đồng bộ: xếp hàng rồi vài chục giây sau mới báo
        // "không có gì để tổng hợp" là bắt người dùng chờ một lượt chạy vô ích.
        var verdicts = await BuildVerdictsAsync(companyId, applicationId);
        if (verdicts.Count == 0)
            throw Bad("Chưa có phiếu chấm phỏng vấn nào được nộp — chưa có ý kiến nào để tổng hợp.");

        var entry = await _summaryRepo.EnqueueAsync(companyId, applicationId, userId);
        _logger.Information("RequestPanelSummary: hồ sơ={AppId} vào hàng đợi (summary={Id}, {N} phiếu).",
            applicationId, entry.SummaryId, verdicts.Count);

        return await MapStatusAsync(companyId, entry, verdicts.Count);
    }

    public async Task<PanelSummaryStatusDto> GetStatusAsync(long companyId, long applicationId)
    {
        var entry = await _summaryRepo.GetByApplicationAsync(companyId, applicationId);
        if (entry is null)
        {
            // Chưa bao giờ tổng hợp -> NONE, không phải lỗi.
            return new PanelSummaryStatusDto
            {
                ApplicationId = applicationId,
                Status = "NONE",
                Running = false,
                CurrentVerdictCount = await CountVerdictsAsync(companyId, applicationId)
            };
        }

        return await MapStatusAsync(companyId, entry, null);
    }

    public async Task RunSummaryAsync(
        long companyId, long applicationId, long summaryId, CancellationToken ct = default)
    {
        // Chạy trong worker: KHÔNG được ném ra ngoài. Mọi kết cục phải nằm lại trong dòng hàng
        // đợi — đó là thứ duy nhất người dùng còn nhìn thấy.
        try
        {
            var verdicts = await BuildVerdictsAsync(companyId, applicationId);
            if (verdicts.Count == 0)
            {
                // Phiếu bị rút / hồ sơ bị xoá trong lúc xếp hàng.
                await CloseAsync(companyId, summaryId, applicationId, PanelSummaryStatus.Failed, null,
                    PanelSummaryErrorCode.NoVerdicts, "Không còn phiếu chấm nào để tổng hợp.");
                return;
            }

            var candidate = await BuildCandidateLineAsync(companyId, applicationId);

            PanelSummaryResult result;
            try
            {
                result = await _summaryClient.SummarizeAsync(candidate, verdicts, ct);
            }
            catch (Exception ex)
            {
                _logger.Warning(ex, "RunPanelSummary: AI tổng hợp thất bại (hồ sơ={AppId}).", applicationId);
                await CloseAsync(companyId, summaryId, applicationId, PanelSummaryStatus.Failed, null,
                    PanelSummaryErrorCode.AiFailed,
                    "AI chưa tổng hợp được các phiếu chấm — vui lòng thử lại sau, " +
                    "hoặc đọc trực tiếp từng phiếu bên dưới.");
                return;
            }

            var outcome = new PanelSummaryOutcome(
                result.Consensus,
                JsonSerializer.Serialize(result.Agreements, JsonOpts),
                JsonSerializer.Serialize(result.Disagreements, JsonOpts),
                JsonSerializer.Serialize(result.OpenQuestions, JsonOpts),
                verdicts.Count);

            await CloseAsync(companyId, summaryId, applicationId, PanelSummaryStatus.Done, outcome, null, null);
            _logger.Information(
                "RunPanelSummary: hồ sơ={AppId} xong ({N} phiếu, {A} điểm đồng ý, {D} điểm lệch).",
                applicationId, verdicts.Count, result.Agreements.Count, result.Disagreements.Count);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "RunPanelSummary: lỗi không mong đợi (hồ sơ={AppId}, summary={Id}).",
                applicationId, summaryId);
            try
            {
                await CloseAsync(companyId, summaryId, applicationId, PanelSummaryStatus.Failed, null,
                    PanelSummaryErrorCode.AiFailed, "Tổng hợp ý kiến thất bại — vui lòng thử lại.");
            }
            catch (Exception closeEx)
            {
                // Đóng cũng hỏng -> dòng còn RUNNING; worker thu hồi ở lần khởi động sau.
                _logger.Error(closeEx, "RunPanelSummary: không đóng nổi dòng hàng đợi {Id}.", summaryId);
            }
        }
    }

    // ============================================================

    /// <summary>
    /// Gom các phiếu ĐÃ NỘP của mọi vòng thành đầu vào cho AI. Bỏ phiếu rỗng (nộp nhưng không
    /// viết gì): đưa vào chỉ tổ cho model đếm nhầm số người có ý kiến.
    /// </summary>
    private async Task<List<PanelVerdictInput>> BuildVerdictsAsync(long companyId, long applicationId)
    {
        var brief = await _scoringService.GetDecisionBriefAsync(companyId, applicationId);

        return brief.Rounds
            .SelectMany(r => r.Verdicts.Select(v => new PanelVerdictInput(
                string.IsNullOrWhiteSpace(v.InterviewerName)
                    ? $"Người phỏng vấn #{v.InterviewerId}"
                    : v.InterviewerName,
                r.RoundNumber,
                v.Recommendation,
                v.Summary,
                v.Notes
                    .Where(n => !string.IsNullOrWhiteSpace(n.Note))
                    .Select(n => new PanelCriterionNote(n.CriteriaName, n.Note))
                    .ToList())))
            .Where(v => !string.IsNullOrWhiteSpace(v.Summary)
                        || v.Notes.Count > 0
                        || !string.IsNullOrWhiteSpace(v.Recommendation))
            .ToList();
    }

    private async Task<int> CountVerdictsAsync(long companyId, long applicationId)
    {
        try
        {
            return (await BuildVerdictsAsync(companyId, applicationId)).Count;
        }
        catch (BaseException)
        {
            // Hồ sơ không còn -> coi như không có phiếu nào; GetStatus không nên vì thế mà 404.
            return 0;
        }
    }

    /// <summary>Một dòng "ứng viên X — vị trí Y" để AI gọi đúng tên, không phải để nó suy đoán thêm.</summary>
    private async Task<string> BuildCandidateLineAsync(long companyId, long applicationId)
    {
        var detail = await _applicationRepo.GetDetailAsync(companyId, applicationId);
        return detail is null ? "" : $"{detail.CandidateName} — ứng tuyển vị trí {detail.JobTitle}";
    }

    private async Task CloseAsync(
        long companyId, long summaryId, long applicationId, string status,
        PanelSummaryOutcome? outcome, string? errorCode, string? errorMessage)
    {
        var rows = await _summaryRepo.FinishAsync(
            companyId, summaryId, status, outcome, errorCode, errorMessage);
        if (rows == 0)
        {
            // Không đóng được = dòng còn treo RUNNING dưới mắt người dùng. Phải kêu lên, đừng im.
            _logger.Error("RunPanelSummary: đóng dòng {Id} (hồ sơ={AppId}) không đổi được dòng nào.",
                summaryId, applicationId);
        }
    }

    private async Task<PanelSummaryStatusDto> MapStatusAsync(
        long companyId, Domain.Entities.PanelSummary e, int? knownVerdictCount)
    {
        var dto = new PanelSummaryStatusDto
        {
            ApplicationId = e.ApplicationId,
            Status = e.Status,
            Running = e.Status is PanelSummaryStatus.Pending or PanelSummaryStatus.Running,
            ErrorCode = e.ErrorCode,
            ErrorMessage = e.ErrorMessage,
            RequestedAt = e.RequestedAt,
            FinishedAt = e.FinishedAt,
            CurrentVerdictCount = knownVerdictCount ?? await CountVerdictsAsync(companyId, e.ApplicationId)
        };

        if (e.Status == PanelSummaryStatus.Done && !string.IsNullOrWhiteSpace(e.Consensus))
        {
            dto.Result = new PanelSummaryResultDto
            {
                Consensus = e.Consensus,
                Agreements = Deserialize(e.AgreementsJson),
                Disagreements = Deserialize(e.DisagreementsJson),
                OpenQuestions = Deserialize(e.OpenQuestionsJson),
                SourceVerdictCount = e.SourceVerdictCount ?? 0
            };
        }

        return dto;
    }

    /// <summary>JSON hỏng không được làm rớt cả màn hình — trả danh sách rỗng và đi tiếp.</summary>
    private static List<string> Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<string>>(json, JsonOpts) ?? [];
        }
        catch (JsonException)
        {
            return [];
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
