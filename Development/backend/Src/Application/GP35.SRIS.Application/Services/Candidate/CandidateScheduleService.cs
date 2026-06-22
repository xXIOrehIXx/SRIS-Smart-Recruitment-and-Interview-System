using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Candidate.Schedule;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.CandidatePortal;

/// <summary>Ứng viên chọn/xác nhận lịch phỏng vấn (docs 15). Khóa lạc quan khi chốt khung.</summary>
public class CandidateScheduleService : BaseService<CandidateScheduleService>, ICandidateScheduleService
{
    private const string Purpose = "SCHEDULE";

    private readonly IMagicLinkService _magicLink;
    private readonly IApplicationRepo _appRepo;
    private readonly ISchedulingRepo _schedulingRepo;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly INotificationService _notify;
    private readonly ILogger _logger;

    public CandidateScheduleService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _schedulingRepo = serviceProvider.GetRequiredService<ISchedulingRepo>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _notify = serviceProvider.GetRequiredService<INotificationService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CandidateScheduleService>();
    }

    public async Task<CandidateScheduleDto> GetScheduleAsync(string rawToken)
    {
        var v = await _magicLink.ValidateAsync(rawToken, Purpose);

        var schedule = await _schedulingRepo.GetLatestScheduleAsync(v.CompanyId, v.ApplicationId)
            ?? throw Conflict("Chưa có lịch phỏng vấn nào được mở.");

        var dto = new CandidateScheduleDto
        {
            ScheduleId = schedule.ScheduleId,
            RoundNumber = schedule.RoundNumber,
            Status = schedule.Status
        };

        if (string.Equals(schedule.Status, InterviewScheduleStatus.Pending, StringComparison.OrdinalIgnoreCase))
        {
            var slots = await _schedulingRepo.GetSlotsAsync(v.CompanyId, schedule.ScheduleId, onlyOpenFuture: true);
            dto.Slots = slots.Select(ToCandidateSlot).ToList();
        }
        else if (string.Equals(schedule.Status, InterviewScheduleStatus.Confirmed, StringComparison.OrdinalIgnoreCase)
                 && schedule.ConfirmedSlotId is long confirmedId)
        {
            var slot = await _schedulingRepo.GetSlotAsync(v.CompanyId, confirmedId);
            if (slot is not null) dto.ConfirmedSlot = ToCandidateSlot(slot);
        }

        return dto;
    }

    public async Task<ScheduleConfirmationDto> ConfirmAsync(string rawToken, ConfirmSlotDto dto)
    {
        var v = await _magicLink.ValidateAsync(rawToken, Purpose);

        var schedule = await _schedulingRepo.GetLatestPendingScheduleAsync(v.CompanyId, v.ApplicationId)
            ?? throw Conflict("Không có lịch nào đang chờ bạn xác nhận.");

        var slot = await _schedulingRepo.GetSlotAsync(v.CompanyId, dto.SlotId)
            ?? throw NotFound("Không tìm thấy khung giờ.");

        if (slot.ScheduleId != schedule.ScheduleId)
            throw Bad("Khung giờ không thuộc lịch này.");
        if (!string.Equals(slot.Status, InterviewSlotStatus.Open, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Khung này đã được đặt hoặc đã khóa. Vui lòng chọn khung khác.");
        if (slot.StartTime <= DateTime.UtcNow)
            throw Conflict("Khung này đã qua giờ. Vui lòng chọn khung khác.");

        // Chống trùng giờ interviewer ở lịch khác (best-effort — 15.3).
        if (await _schedulingRepo.IsInterviewerBookedAtAsync(v.CompanyId, slot.InterviewerId, slot.StartTime, slot.SlotId))
            throw Conflict("Người phỏng vấn đã có lịch vào giờ này. Vui lòng chọn khung khác.");

        // Khóa lạc quan: ai chốt trước được trước (15.3).
        var booked = await _schedulingRepo.BookAndConfirmAsync(v.CompanyId, schedule.ScheduleId, slot.SlotId);
        if (!booked)
            throw Conflict("Khung vừa có người đặt. Vui lòng chọn khung khác.");

        await _magicLink.MarkUsedAsync(v.CompanyId, v.TokenId); // one-time: đốt khi CHỐT (5.13)

        await _activityLogRepo.InsertAsync(v.CompanyId, new ActivityLog
        {
            ApplicationId = v.ApplicationId,
            Action = "INTERVIEW_SCHEDULED",
            Detail = $"Vòng {schedule.RoundNumber}, khung {slot.StartTime:O}."
        });

        // Email xác nhận + .ics + link Google Calendar (best-effort — không làm rớt việc chốt lịch).
        await _notify.SendInterviewConfirmedAsync(v.CompanyId, v.ApplicationId, slot.StartTime);

        _logger.Information("Scheduling: ứng viên chốt khung slot={SlotId} schedule={ScheduleId}.",
            slot.SlotId, schedule.ScheduleId);

        return new ScheduleConfirmationDto
        {
            ScheduleId = schedule.ScheduleId,
            SlotId = slot.SlotId,
            StartTime = slot.StartTime,
            Status = InterviewScheduleStatus.Confirmed
        };
    }

    public async Task NoSlotFitsAsync(string rawToken)
    {
        var v = await _magicLink.ValidateAsync(rawToken, Purpose);

        var schedule = await _schedulingRepo.GetLatestPendingScheduleAsync(v.CompanyId, v.ApplicationId)
            ?? throw Conflict("Không có lịch nào đang chờ bạn xác nhận.");

        await _schedulingRepo.SetScheduleStatusAsync(v.CompanyId, schedule.ScheduleId, InterviewScheduleStatus.NoSlotFits);
        await _magicLink.MarkUsedAsync(v.CompanyId, v.TokenId);

        await _activityLogRepo.InsertAsync(v.CompanyId, new ActivityLog
        {
            ApplicationId = v.ApplicationId,
            Action = "INTERVIEW_NO_SLOT_FITS",
            Detail = $"Vòng {schedule.RoundNumber}."
        });

        _logger.Information("Scheduling: ứng viên báo không khung phù hợp schedule={ScheduleId}.", schedule.ScheduleId);
    }

    // ============================================================

    private static CandidateSlotDto ToCandidateSlot(InterviewSlot s) => new()
    {
        SlotId = s.SlotId,
        StartTime = s.StartTime
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
