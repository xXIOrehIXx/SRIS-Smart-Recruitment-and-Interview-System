using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Đặt lịch phỏng vấn — Recruiter mở khung (Section 15). KÉO trước (card ở INTERVIEW), TẠO sau (15.1).
/// </summary>
public class InterviewSchedulingService : BaseService<InterviewSchedulingService>, IInterviewSchedulingService
{
    private readonly IApplicationRepo _appRepo;
    private readonly ISchedulingRepo _schedulingRepo;
    private readonly IMagicLinkService _magicLink;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly INotificationService _notify;
    private readonly ILogger _logger;

    public InterviewSchedulingService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _schedulingRepo = serviceProvider.GetRequiredService<ISchedulingRepo>();
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _notify = serviceProvider.GetRequiredService<INotificationService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<InterviewSchedulingService>();
    }

    public async Task<CreateInterviewRequestResultDto> CreateRequestAsync(
        long companyId, long userId, long applicationId, CreateInterviewRequestDto dto)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        // KÉO trước, TẠO sau (15.1): chỉ đặt lịch khi card đã ở INTERVIEW.
        if (!string.Equals(app.CurrentState, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Chỉ tạo lịch phỏng vấn khi hồ sơ ở bước INTERVIEW (kéo card sang INTERVIEW trước).");

        ValidateSlots(dto.Slots);

        var round = dto.RoundNumber ?? await _schedulingRepo.GetNextRoundNumberAsync(companyId, applicationId);

        var schedule = new InterviewSchedule
        {
            ApplicationId = applicationId,
            RoundNumber = round,
            Status = InterviewScheduleStatus.Pending
        };
        var slots = dto.Slots.Select(s => new InterviewSlot
        {
            InterviewerId = s.InterviewerId,
            StartTime = s.StartTime,
            Status = InterviewSlotStatus.Open
        }).ToList();

        var scheduleId = await _schedulingRepo.InsertScheduleWithSlotsAsync(companyId, schedule, slots);

        // Phát magic link SCHEDULE cho ứng viên (token gốc chỉ có ở đây — gửi qua email).
        var issued = await _magicLink.IssueAsync(companyId, applicationId, "SCHEDULE");

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "INTERVIEW_REQUEST_CREATED",
            Detail = $"Vòng {round}, mở {slots.Count} khung."
        });

        _logger.Information("Scheduling: tạo lịch schedule={ScheduleId} app={AppId} vòng {Round} ({Count} khung).",
            scheduleId, applicationId, round, slots.Count);

        return new CreateInterviewRequestResultDto
        {
            Schedule = MapSchedule(schedule, slots),
            MagicToken = issued.RawToken,
            TokenExpiresAt = issued.ExpiresAt
        };
    }

    public async Task<IReadOnlyList<InterviewScheduleDto>> GetByApplicationAsync(long companyId, long applicationId)
    {
        var data = await _schedulingRepo.GetByApplicationAsync(companyId, applicationId);
        return data.Select(x => MapSchedule(x.Schedule, x.Slots)).ToList();
    }

    public async Task<CreateInterviewRequestResultDto> RescheduleAsync(
        long companyId, long userId, long applicationId, long scheduleId, RescheduleRequestDto dto)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        if (!string.Equals(app.CurrentState, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Chỉ dời lịch khi hồ sơ đang ở bước INTERVIEW.");

        var schedule = await _schedulingRepo.GetScheduleByIdAsync(companyId, scheduleId)
            ?? throw NotFound($"Không tìm thấy lịch (schedule_id={scheduleId}).");
        if (schedule.ApplicationId != applicationId)
            throw Bad("Lịch không thuộc hồ sơ này.");
        if (string.Equals(schedule.Status, InterviewScheduleStatus.Cancelled, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Lịch đã bị hủy, không thể dời. Hãy tạo lịch mới.");

        // Luật nghiệp vụ: chỉ cho dời 1 lần / lịch.
        if (schedule.RescheduleCount >= 1)
            throw Conflict("Lịch này đã được dời 1 lần — không thể dời thêm. Hãy tạo lịch mới nếu cần.");

        ValidateSlots(dto.Slots);

        var slots = dto.Slots.Select(s => new InterviewSlot
        {
            InterviewerId = s.InterviewerId,
            StartTime = s.StartTime,
            Status = InterviewSlotStatus.Open
        }).ToList();

        await _schedulingRepo.ReplaceSlotsAndReopenAsync(companyId, scheduleId, slots);

        // Phát lại magic link SCHEDULE (IssueAsync tự gửi email khung mới cho ứng viên).
        var issued = await _magicLink.IssueAsync(companyId, applicationId, "SCHEDULE");

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "INTERVIEW_RESCHEDULED",
            Detail = $"Vòng {schedule.RoundNumber}, mở lại {slots.Count} khung."
        });

        _logger.Information("Scheduling: dời lịch schedule={ScheduleId} app={AppId} ({Count} khung mới).",
            scheduleId, applicationId, slots.Count);

        // Đọc lại để trả RescheduleCount mới nhất.
        var updated = await _schedulingRepo.GetScheduleByIdAsync(companyId, scheduleId) ?? schedule;
        return new CreateInterviewRequestResultDto
        {
            Schedule = MapSchedule(updated, slots),
            MagicToken = issued.RawToken,
            TokenExpiresAt = issued.ExpiresAt
        };
    }

    public async Task CancelAsync(
        long companyId, long userId, long applicationId, long scheduleId, CancelScheduleDto dto)
    {
        var schedule = await _schedulingRepo.GetScheduleByIdAsync(companyId, scheduleId)
            ?? throw NotFound($"Không tìm thấy lịch (schedule_id={scheduleId}).");
        if (schedule.ApplicationId != applicationId)
            throw Bad("Lịch không thuộc hồ sơ này.");

        var cancelled = await _schedulingRepo.CancelScheduleAsync(companyId, scheduleId);
        if (!cancelled)
            throw Conflict("Lịch đã bị hủy trước đó.");

        // Giờ đã chốt (nếu có) để báo trong email hủy.
        DateTime? confirmedStart = null;
        if (schedule.ConfirmedSlotId is long slotId)
        {
            var slot = await _schedulingRepo.GetSlotAsync(companyId, slotId);
            confirmedStart = slot?.StartTime;
        }

        var reason = string.IsNullOrWhiteSpace(dto.Reason) ? null : dto.Reason.Trim();
        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "INTERVIEW_CANCELLED",
            Detail = reason is null ? $"Vòng {schedule.RoundNumber}." : $"Vòng {schedule.RoundNumber}. Lý do: {reason}"
        });

        // Email báo ứng viên (best-effort — không làm rớt việc hủy).
        await _notify.SendInterviewCancelledAsync(companyId, applicationId, confirmedStart, reason);

        _logger.Information("Scheduling: hủy lịch schedule={ScheduleId} app={AppId}.", scheduleId, applicationId);
    }

    // ============================================================

    /// <summary>Validate bộ khung: ≥1 khung, mỗi khung có interviewer + thời điểm ở tương lai.</summary>
    private static void ValidateSlots(List<SlotInputDto>? slots)
    {
        if (slots is null || slots.Count == 0)
            throw Bad("Phải mở ít nhất 1 khung giờ.");

        var now = DateTime.UtcNow;
        foreach (var s in slots)
        {
            if (s.InterviewerId <= 0)
                throw Bad("Mỗi khung phải gán 1 người phỏng vấn (interviewerId).");
            if (s.StartTime <= now)
                throw Bad("Khung giờ phải ở tương lai.");
        }
    }

    private static InterviewScheduleDto MapSchedule(InterviewSchedule s, IReadOnlyList<InterviewSlot> slots) => new()
    {
        ScheduleId = s.ScheduleId,
        ApplicationId = s.ApplicationId,
        RoundNumber = s.RoundNumber,
        Status = s.Status,
        ConfirmedSlotId = s.ConfirmedSlotId,
        RescheduleCount = s.RescheduleCount,
        Slots = slots.Select(x => new SlotDto
        {
            SlotId = x.SlotId,
            InterviewerId = x.InterviewerId,
            StartTime = x.StartTime,
            Status = x.Status
        }).ToList()
    };

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
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
