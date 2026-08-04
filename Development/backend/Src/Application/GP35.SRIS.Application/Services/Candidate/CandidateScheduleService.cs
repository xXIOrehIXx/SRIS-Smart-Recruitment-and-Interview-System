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

        if (string.Equals(schedule.Status, InterviewScheduleStatus.Pending, StringComparison.OrdinalIgnoreCase)
            && schedule.PoolId is long poolId)
        {
            // Khung lấy từ POOL dùng chung — chỉ OPEN + tương lai (người khác đặt rồi thì không thấy).
            var slots = await _schedulingRepo.GetSlotsByPoolAsync(v.CompanyId, poolId, onlyOpenFuture: true);
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

        var slot = await _schedulingRepo.GetSlotAsync(v.CompanyId, dto.SlotId)
            ?? throw NotFound("Không tìm thấy khung giờ.");

        // Lời mời lấy theo POOL CỦA KHUNG vừa bấm, không phải "lời mời mới nhất của hồ sơ":
        // magic link phát theo hồ sơ nên khi có nhiều lời mời đang chờ, "mới nhất" có thể là
        // vòng khác — ứng viên bấm khung vòng 1 mà lại chốt nhầm vào lịch vòng 2.
        var schedule = await _schedulingRepo.GetPendingScheduleInPoolAsync(
                v.CompanyId, v.ApplicationId, slot.PoolId)
            ?? throw Conflict("Khung này không thuộc lời mời nào đang chờ bạn xác nhận.");

        if (!string.Equals(slot.Status, InterviewSlotStatus.Open, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Khung này đã được đặt hoặc đã khóa. Vui lòng chọn khung khác.");
        // So với giờ LOCAL của server: start_time lưu dạng local naive (FE gửi không có 'Z' —
        // xem InterviewPoolService.ValidateSlots). So với UtcNow là lệch đúng offset múi giờ
        // (VN +7) -> khung 09:00 sáng nay lúc 14:00 chiều vẫn lọt vì 09:00 > 07:00 UTC.
        if (slot.StartTime <= DateTime.Now)
            throw Conflict("Khung này đã qua giờ. Vui lòng chọn khung khác.");

        // Chống trùng cho CHÍNH ứng viên: không thể ngồi 2 buổi cùng lúc / sát nhau. Phải check
        // trước khi book — pool khác (vòng khác, hoặc pool mở lại) không biết gì về buổi đã chốt.
        var myBusyAt = await _schedulingRepo.FindCandidateBusyAtAsync(
            v.CompanyId, v.ApplicationId, slot.StartTime, InterviewTiming.MinGap, schedule.ScheduleId);
        if (myBusyAt is DateTime busyAt)
            throw Conflict(
                $"Bạn đã có buổi phỏng vấn lúc {busyAt:HH:mm dd/MM/yyyy}. Hai buổi phải cách nhau " +
                $"ít nhất {InterviewTiming.MinGapHours} tiếng — vui lòng chọn khung khác.");

        // Chống trùng giờ interviewer ở lịch khác (best-effort — 15.3). Check CẢ PANEL.
        var panelIds = slot.Interviewers.Select(i => i.InterviewerId).ToList();
        var busy = await _schedulingRepo.FindBusyInterviewerAsync(
            v.CompanyId, panelIds, slot.StartTime, InterviewTiming.MinGap, slot.SlotId);
        if (busy is not null)
            throw Conflict(
                $"Một interviewer trong panel đã có buổi lúc {busy.StartTime:HH:mm dd/MM/yyyy} — " +
                $"các buổi phải cách nhau ít nhất {InterviewTiming.MinGapHours} tiếng. " +
                "Vui lòng chọn khung khác.");

        // Khóa lạc quan: ai chốt trước được trước (15.3). KHÔNG khóa khung khác của pool.
        var booked = await _schedulingRepo.BookAndConfirmAsync(
            v.CompanyId, schedule.ScheduleId, slot.SlotId, v.ApplicationId);
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

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
