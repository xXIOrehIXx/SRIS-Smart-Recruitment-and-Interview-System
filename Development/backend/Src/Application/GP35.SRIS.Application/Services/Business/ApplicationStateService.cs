using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Thực thi state machine hồ sơ (docs 5.8). Luật forward-only ở <see cref="ApplicationStateMachine"/>;
/// service lo guard cần dữ liệu (G2 phiếu chấm SUBMITTED) + audit ActivityLog.
/// </summary>
public class ApplicationStateService : BaseService<ApplicationStateService>, IApplicationStateService
{
    /// <summary>Trục tiến của pipeline (không gồm HIRED/REJECTED — 2 state chốt).</summary>
    private static readonly List<string> ForwardOrder = new()
    {
        ApplicationState.New, ApplicationState.Screening, ApplicationState.Interview, ApplicationState.Offer
    };

    private readonly IApplicationRepo _appRepo;
    private readonly IJobRepo _jobRepo;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly INotificationService _notify;
    private readonly IInterviewPanelService _panel;
    private readonly IContextData _contextData;
    private readonly ILogger _logger;

    public ApplicationStateService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _notify = serviceProvider.GetRequiredService<INotificationService>();
        _panel = serviceProvider.GetRequiredService<IInterviewPanelService>();
        _contextData = serviceProvider.GetRequiredService<IContextData>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<ApplicationStateService>();
    }

    public async Task<ApplicationStateDto> TransitionAsync(
        long companyId, long userId, long applicationId, string toState, string? reason,
        bool isCandidateAnswer = false, IReadOnlyList<long>? interviewerIds = null)
    {
        toState = (toState ?? "").Trim().ToUpperInvariant();
        if (!ApplicationStateMachine.IsValidState(toState))
            throw Bad($"State đích không hợp lệ: '{toState}'.");

        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        var from = app.CurrentState;

        // 2 cửa quyết định của DM: SCREENING→INTERVIEW (chọn ai được vào phỏng vấn) và
        // INTERVIEW→OFFER / rời OFFER (quyết tuyển). Xem EnsureCanDecideAsync.
        if (!isCandidateAnswer)
            await EnsureCanDecideAsync(companyId, userId, app.JobId, from, toState);

        // Người phỏng vấn DM chỉ định (V045) — chỉ có nghĩa khi đưa hồ sơ VÀO vòng phỏng vấn.
        // Kiểm danh sách TRƯỚC khi đổi state: id rác mà phát hiện sau thì hồ sơ đã sang INTERVIEW
        // trong khi chưa ai được chỉ định, và bộ phận nhân sự lãnh trọn lỗi đó ở màn đặt lịch.
        var assignPanel = interviewerIds is { Count: > 0 }
            && string.Equals(toState, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase);
        if (assignPanel)
            await _panel.ValidateAsync(companyId, interviewerIds!);

        var now = DateTime.UtcNow;
        string? rejectReason = null;
        DateTime? rejectedAt = null;
        DateTime? hiredAt = null;

        if (string.Equals(toState, ApplicationState.Rejected, StringComparison.OrdinalIgnoreCase))
        {
            if (!ApplicationStateMachine.CanReject(from))
                throw Conflict($"Không thể loại hồ sơ đang ở trạng thái {from}.");

            // Lý do loại là TÙY CHỌN: ép nhập chỉ đẻ ra lý do rác ("ko phù hợp"), không giúp
            // thống kê. Ai muốn ghi thì ghi; bỏ trống -> null (cột reject_reason vốn NULL được).
            rejectReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
            rejectedAt = now;
        }
        else
        {
            if (string.Equals(from, toState, StringComparison.OrdinalIgnoreCase))
                throw Conflict($"Hồ sơ đã ở trạng thái {toState}.");
            if (!ApplicationStateMachine.IsForwardAllowed(from, toState))
                throw Conflict($"Không thể chuyển {from} → {toState} (forward-only — 5.8).");

            await EnforceGuardsAsync(companyId, applicationId, from, toState);

            if (string.Equals(toState, ApplicationState.Hired, StringComparison.OrdinalIgnoreCase))
                hiredAt = now;
        }

        var rows = await _appRepo.TransitionStateAsync(
            companyId, applicationId, toState, rejectReason, now, rejectedAt, hiredAt);
        if (rows == 0)
            throw NotFound($"Không cập nhật được hồ sơ (application_id={applicationId}).");

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "STATE_CHANGE",
            FromState = from,
            ToState = toState,
            Detail = reason
        });

        _logger.Information("Pipeline: hồ sơ {AppId} chuyển {From} → {To} (user={UserId}).",
            applicationId, from, toState, userId);

        // Ghi chỉ định người phỏng vấn ngay sau khi hồ sơ vào vòng phỏng vấn. Quyền đã kiểm ở
        // EnsureCanDecideAsync (cùng một luật: DM phụ trách vị trí) nên không kiểm lại.
        if (assignPanel)
            await _panel.AssignAsync(companyId, userId, applicationId, interviewerIds!, alreadyAuthorized: true);

        // Email kết quả khi chốt (HIRED/REJECTED). Best-effort — không làm rớt transition.
        await _notify.SendResultAsync(companyId, applicationId, toState);

        // Trúng tuyển thì gửi thêm email onboarding (giờ làm, ngày đầu đi làm, hồ sơ cần nộp).
        // Chỉ gửi khi công ty đã soạn mẫu — service tự kiểm, không có mẫu thì im lặng bỏ qua.
        if (string.Equals(toState, ApplicationState.Hired, StringComparison.OrdinalIgnoreCase))
            await _notify.SendOnboardingAsync(companyId, applicationId);

        return new ApplicationStateDto
        {
            ApplicationId = applicationId,
            FromState = from,
            ToState = toState,
            ChangedAt = now
        };
    }

    public Task<ApplicationStateDto> RejectAsync(long companyId, long userId, long applicationId, string? reason)
        => TransitionAsync(companyId, userId, applicationId, ApplicationState.Rejected, reason);

    public async Task AdvanceToAsync(long companyId, long userId, long applicationId, string targetState)
    {
        targetState = (targetState ?? "").Trim().ToUpperInvariant();
        if (!ApplicationStateMachine.IsValidState(targetState))
            throw Bad($"State đích không hợp lệ: '{targetState}'.");

        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        var fromIndex = ForwardOrder.IndexOf(app.CurrentState.ToUpperInvariant());
        var targetIndex = ForwardOrder.IndexOf(targetState);

        // Hồ sơ đã chốt (HIRED/REJECTED) không nằm trên trục tiến -> không tự đẩy được.
        if (fromIndex < 0)
            throw Conflict($"Hồ sơ đang ở trạng thái {app.CurrentState} — không thể tự chuyển tiếp.");
        if (targetIndex < 0)
            throw Bad($"Không tự chuyển tiếp tới {targetState} được (chỉ đi trên trục NEW→OFFER).");

        // Đã ở đúng đó hoặc đã đi xa hơn -> việc nghiệp vụ vẫn hợp lệ, không đụng state.
        if (fromIndex >= targetIndex)
            return;

        // Kiểm quyền của CẢ chặng đường TRƯỚC khi đi bước nào: NEW→SCREENING qua được nhưng
        // SCREENING→INTERVIEW bị chặn thì hồ sơ đã nhảy một nấc rồi mới báo lỗi — người dùng
        // thấy state đổi trong khi việc họ bấm thất bại.
        for (var i = fromIndex; i < targetIndex; i++)
            await EnsureCanDecideAsync(companyId, userId, app.JobId, ForwardOrder[i], ForwardOrder[i + 1]);

        // Đi TỪNG BƯỚC để mỗi chặng đều qua guard + ghi ActivityLog (audit không bị hổng).
        for (var i = fromIndex; i < targetIndex; i++)
            await TransitionAsync(companyId, userId, applicationId, ForwardOrder[i + 1], null);
    }

    // ============================================================

    /// <summary>
    /// Hai cửa có người gác (docs 5.14 — cập nhật 15/08/2026 sau bảo vệ hội đồng):
    /// <list type="bullet">
    /// <item>SCREENING→INTERVIEW — CHỌN ứng viên vào vòng phỏng vấn: <b>Trưởng bộ phận phụ trách
    /// vị trí</b>. Chuyên môn ai đáng gặp là của họ; Human Resource chỉ LÊN LỊCH cho người đã duyệt.
    /// Cửa này BẮT BUỘC job phải có DM — không gán thì không ai duyệt được, chặn ngay và nói rõ.</item>
    /// <item>INTERVIEW→OFFER và rời OFFER (→HIRED / →REJECTED) — QUYẾT TUYỂN: <b>Giám đốc</b>.
    /// Trưởng bộ phận không đủ thẩm quyền tuyển, họ chỉ ĐỀ XUẤT (<c>HiringProposal</c>) và Giám đốc
    /// duyệt đề xuất đó — chính đường duyệt gọi vào đây. Giám đốc có phạm vi TOÀN CÔNG TY nên không
    /// đối chiếu với vị trí nào cả.</item>
    /// </list>
    /// Admin là superuser -> bỏ qua cả hai (công ty nhỏ 1 tài khoản chạy trọn luồng).
    /// </summary>
    private async Task EnsureCanDecideAsync(long companyId, long userId, long jobId, string from, string to)
    {
        bool isScreeningToInterview = string.Equals(from, ApplicationState.Screening, StringComparison.OrdinalIgnoreCase) &&
                                      string.Equals(to, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase);
        bool isInterviewToOffer = string.Equals(from, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase) &&
                                  string.Equals(to, ApplicationState.Offer, StringComparison.OrdinalIgnoreCase);
        bool isLeavingOffer = string.Equals(from, ApplicationState.Offer, StringComparison.OrdinalIgnoreCase);

        if (!isScreeningToInterview && !isInterviewToOffer && !isLeavingOffer)
            return;

        // userId = 0 -> hành động không đến từ một người dùng Portal cụ thể (job nền, seed…).
        // Riêng việc ghi nhận câu trả lời của ứng viên với thư mời đi bằng cờ isCandidateAnswer
        // (xem TransitionAsync), không mượn userId = 0 nữa — để ActivityLog vẫn ghi ĐÚNG ai bấm.
        if (userId <= 0)
            return;

        if (string.Equals(_contextData.Role, RoleConstants.Admin, StringComparison.OrdinalIgnoreCase))
            return;

        // ----- Cửa quyết tuyển: của Giám đốc, không phụ thuộc vị trí -----
        if (isInterviewToOffer || isLeavingOffer)
        {
            if (!string.Equals(_contextData.Role, RoleConstants.Director, StringComparison.OrdinalIgnoreCase))
                throw Forbidden(isInterviewToOffer
                    ? "Chỉ Giám đốc mới quyết tuyển. Trưởng bộ phận hãy gửi ĐỀ XUẤT TUYỂN để Giám đốc duyệt."
                    : "Chỉ Giám đốc mới chốt kết quả ở bước Quyết định.");
            return;
        }

        // ----- Cửa vào vòng phỏng vấn: của Trưởng bộ phận phụ trách vị trí -----
        var job = await _jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy vị trí (job) của hồ sơ (job_id={jobId}).");

        if (job.DepartmentManagerId is not long dmId)
            throw Forbidden(
                "Vị trí này chưa gán Trưởng bộ phận phụ trách nên chưa ai duyệt được ứng viên vào vòng " +
                "phỏng vấn. Hãy gán người phụ trách cho tin tuyển dụng trước.");

        if (dmId != userId)
            throw Forbidden("Chỉ Trưởng bộ phận phụ trách vị trí này mới được duyệt ứng viên vào vòng phỏng vấn.");
    }

    /// <summary>Kiểm guard cần dữ liệu trước khi tiến.</summary>
    private async Task EnforceGuardsAsync(long companyId, long applicationId, string from, string to)
    {
        if (ApplicationStateMachine.RequiresGuardG2(from, to))
        {
            var submitted = await _appRepo.CountSubmittedInterviewScoresAsync(companyId, applicationId);
            if (submitted < 1)
                throw Conflict("Guard G2 chưa đạt: cần ít nhất 1 phiếu chấm phỏng vấn đã nộp.");
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

    private static BaseException Forbidden(string msg) => new(msg)
    {
        ErrorCode = "FORBIDDEN", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Forbidden
    };

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "INVALID_TRANSITION", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
