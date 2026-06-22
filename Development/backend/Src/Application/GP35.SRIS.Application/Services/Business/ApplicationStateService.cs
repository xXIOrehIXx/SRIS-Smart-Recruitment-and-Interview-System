using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Thực thi state machine hồ sơ (docs 5.8). Luật forward-only ở <see cref="ApplicationStateMachine"/>;
/// service lo guard cần dữ liệu (G1 quiz đã nộp, G2 phiếu chấm SUBMITTED) + audit ActivityLog.
/// </summary>
public class ApplicationStateService : BaseService<ApplicationStateService>, IApplicationStateService
{
    private readonly IApplicationRepo _appRepo;
    private readonly IQuizAttemptRepo _attemptRepo;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly ILogger _logger;

    public ApplicationStateService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _attemptRepo = serviceProvider.GetRequiredService<IQuizAttemptRepo>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<ApplicationStateService>();
    }

    public async Task<ApplicationStateDto> TransitionAsync(
        long companyId, long userId, long applicationId, string toState, string? reason)
    {
        toState = (toState ?? "").Trim().ToUpperInvariant();
        if (!ApplicationStateMachine.IsValidState(toState))
            throw Bad($"State đích không hợp lệ: '{toState}'.");

        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        var from = app.CurrentState;
        var now = DateTime.UtcNow;
        string? rejectReason = null;
        DateTime? rejectedAt = null;
        DateTime? hiredAt = null;

        if (string.Equals(toState, ApplicationState.Rejected, StringComparison.OrdinalIgnoreCase))
        {
            if (!ApplicationStateMachine.CanReject(from))
                throw Conflict($"Không thể loại hồ sơ đang ở trạng thái {from}.");
            if (string.IsNullOrWhiteSpace(reason))
                throw Bad("Bắt buộc nhập lý do loại hồ sơ (reject_reason).");

            rejectReason = reason.Trim();
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

        return new ApplicationStateDto
        {
            ApplicationId = applicationId,
            FromState = from,
            ToState = toState,
            ChangedAt = now
        };
    }

    public Task<ApplicationStateDto> RejectAsync(long companyId, long userId, long applicationId, string reason)
        => TransitionAsync(companyId, userId, applicationId, ApplicationState.Rejected, reason);

    // ============================================================

    /// <summary>Kiểm guard cần dữ liệu trước khi tiến.</summary>
    private async Task EnforceGuardsAsync(long companyId, long applicationId, string from, string to)
    {
        if (ApplicationStateMachine.RequiresGuardG1(from, to))
        {
            var hasQuiz = await _attemptRepo.HasSubmittedAttemptAsync(companyId, applicationId);
            if (!hasQuiz)
                throw Conflict("Guard G1 chưa đạt: ứng viên chưa nộp bài quiz nào.");
        }

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

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "INVALID_TRANSITION", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
