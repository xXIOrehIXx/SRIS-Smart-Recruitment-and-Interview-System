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
/// Đặt lịch phỏng vấn theo POOL dùng chung — Recruiter (Section 15). KÉO trước (card ở INTERVIEW),
/// MỜI sau. Ai chốt trước lấy trước; các khung khác giữ OPEN cho người sau.
///
/// Mở rộng A: mỗi khung có 1..N interviewer (panel) — Recruiter có thể chọn 3–5 người cùng dự buổi phỏng vấn.
/// </summary>
public class InterviewPoolService : BaseService<InterviewPoolService>, IInterviewPoolService
{
    /// <summary>Số interviewer tối đa trong 1 panel khung.</summary>
    private const int MaxPanelSize = 5;

    private readonly IApplicationRepo _appRepo;
    private readonly ISchedulingRepo _schedulingRepo;
    private readonly IUserRepo _userRepo;
    private readonly IMagicLinkService _magicLink;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly INotificationService _notify;
    private readonly ILogger _logger;

    public InterviewPoolService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _schedulingRepo = serviceProvider.GetRequiredService<ISchedulingRepo>();
        _userRepo = serviceProvider.GetRequiredService<IUserRepo>();
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _notify = serviceProvider.GetRequiredService<INotificationService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<InterviewPoolService>();
    }

    public async Task<PoolDto> CreatePoolAsync(long companyId, long userId, long jobId, CreatePoolDto dto)
    {
        ValidateSlots(dto.Slots);

        var pool = new InterviewSlotPool
        {
            JobId = jobId,
            RoundNumber = dto.RoundNumber ?? 1,
            Status = InterviewPoolStatus.Open,
            CreatedBy = userId > 0 ? userId : null
        };
        var slots = dto.Slots.Select(s => new InterviewSlot
        {
            StartTime = s.StartTime,
            Status = InterviewSlotStatus.Open,
            InterviewerIds = s.InterviewerIds.Distinct().ToList()
        }).ToList();

        var poolId = await _schedulingRepo.InsertPoolWithSlotsAsync(companyId, pool, slots);

        _logger.Information("Scheduling: mở pool={PoolId} job={JobId} vòng {Round} ({Count} khung).",
            poolId, jobId, pool.RoundNumber, slots.Count);

        var created = await _schedulingRepo.GetPoolByIdAsync(companyId, poolId) ?? pool;
        return await BuildPoolDtoAsync(companyId, created);
    }

    public async Task<InviteResultDto> InviteAsync(long companyId, long userId, long poolId, InvitePoolDto dto)
    {
        var pool = await _schedulingRepo.GetPoolByIdAsync(companyId, poolId)
            ?? throw NotFound($"Không tìm thấy pool khung (pool_id={poolId}).");
        if (!string.Equals(pool.Status, InterviewPoolStatus.Open, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Pool không còn mở — không mời thêm được. Hãy tạo pool mới.");

        var result = new InviteResultDto();
        foreach (var applicationId in (dto.ApplicationIds ?? new()).Distinct())
        {
            var app = await _appRepo.GetByIdAsync(companyId, applicationId);
            if (app is null)
            {
                result.Skipped.Add(new InviteSkippedDto { ApplicationId = applicationId, Reason = "Không tìm thấy hồ sơ." });
                continue;
            }
            if (!string.Equals(app.CurrentState, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase))
            {
                result.Skipped.Add(new InviteSkippedDto
                {
                    ApplicationId = applicationId,
                    Reason = "Hồ sơ chưa ở bước INTERVIEW (kéo card sang INTERVIEW trước)."
                });
                continue;
            }
            if (await _schedulingRepo.HasActiveInviteInPoolAsync(companyId, poolId, applicationId))
            {
                result.Skipped.Add(new InviteSkippedDto { ApplicationId = applicationId, Reason = "Đã mời vào pool này rồi." });
                continue;
            }

            var scheduleId = await _schedulingRepo.InsertInviteScheduleAsync(companyId, new InterviewSchedule
            {
                ApplicationId = applicationId,
                PoolId = poolId,
                RoundNumber = pool.RoundNumber
            });

            // Phát magic link SCHEDULE (IssueAsync tự gửi email khung cho ứng viên — best-effort).
            var issued = await _magicLink.IssueAsync(companyId, applicationId, "SCHEDULE");

            await _activityLogRepo.InsertAsync(companyId, new ActivityLog
            {
                ApplicationId = applicationId,
                UserId = userId > 0 ? userId : null,
                Action = "INTERVIEW_INVITED",
                Detail = $"Vòng {pool.RoundNumber}, mời vào pool {poolId}."
            });

            result.Invited.Add(new InviteResultItemDto
            {
                ApplicationId = applicationId,
                ScheduleId = scheduleId,
                MagicToken = issued.RawToken,
                TokenExpiresAt = issued.ExpiresAt
            });
        }

        _logger.Information("Scheduling: mời {InvitedCount} ứng viên vào pool={PoolId} (bỏ qua {SkippedCount}).",
            result.Invited.Count, poolId, result.Skipped.Count);

        return result;
    }

    public async Task<IReadOnlyList<PoolDto>> GetPoolsByJobAsync(long companyId, long jobId)
    {
        var pools = await _schedulingRepo.GetPoolsByJobAsync(companyId, jobId);
        var result = new List<PoolDto>(pools.Count);
        foreach (var pw in pools)
            result.Add(await BuildPoolDtoAsync(companyId, pw.Pool, pw.Slots));
        return result;
    }

    public async Task CancelPoolAsync(long companyId, long userId, long poolId, CancelPoolDto dto)
    {
        var pool = await _schedulingRepo.GetPoolByIdAsync(companyId, poolId)
            ?? throw NotFound($"Không tìm thấy pool khung (pool_id={poolId}).");

        // Lấy ứng viên đã chốt (để email hủy) TRƯỚC khi hủy pool.
        var schedules = await _schedulingRepo.GetSchedulesByPoolAsync(companyId, poolId);

        var cancelled = await _schedulingRepo.CancelPoolAsync(companyId, poolId);
        if (!cancelled)
            throw Conflict("Pool đã bị hủy trước đó.");

        var reason = string.IsNullOrWhiteSpace(dto.Reason) ? null : dto.Reason.Trim();

        foreach (var s in schedules.Where(s =>
                     string.Equals(s.Status, InterviewScheduleStatus.Confirmed, StringComparison.OrdinalIgnoreCase)))
        {
            DateTime? start = null;
            if (s.ConfirmedSlotId is long slotId)
            {
                var slot = await _schedulingRepo.GetSlotAsync(companyId, slotId);
                start = slot?.StartTime;
            }
            await _activityLogRepo.InsertAsync(companyId, new ActivityLog
            {
                ApplicationId = s.ApplicationId,
                UserId = userId > 0 ? userId : null,
                Action = "INTERVIEW_CANCELLED",
                Detail = reason is null ? $"Hủy pool {poolId}." : $"Hủy pool {poolId}. Lý do: {reason}"
            });
            await _notify.SendInterviewCancelledAsync(companyId, s.ApplicationId, start, reason);
        }

        _logger.Information("Scheduling: hủy pool={PoolId} job={JobId}.", poolId, pool.JobId);
    }

    public async Task<long> ManualConfirmAsync(long companyId, long userId, long applicationId, ManualConfirmDto dto)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");
        if (!string.Equals(app.CurrentState, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Chỉ chốt lịch tay khi hồ sơ đang ở bước INTERVIEW.");

        if (dto.InterviewerIds is null || dto.InterviewerIds.Count == 0)
            throw Bad("Phải chọn ít nhất 1 interviewer cho panel.");
        if (dto.InterviewerIds.Count > MaxPanelSize)
            throw Bad($"Panel tối đa {MaxPanelSize} interviewer.");
        if (dto.InterviewerIds.Distinct().Count() != dto.InterviewerIds.Count)
            throw Bad("Panel có interviewer bị trùng.");
        if (dto.StartTime <= DateTime.UtcNow)
            throw Bad("Thời điểm phỏng vấn phải ở tương lai.");

        var round = dto.RoundNumber ?? await _schedulingRepo.GetNextRoundNumberAsync(companyId, applicationId);
        var panel = dto.InterviewerIds.Distinct().ToList();

        var scheduleId = await _schedulingRepo.ManualConfirmAsync(
            companyId, app.JobId, applicationId, panel, dto.StartTime, round,
            userId > 0 ? userId : null);

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "INTERVIEW_SCHEDULED",
            Detail = $"Vòng {round}, chốt tay lúc {dto.StartTime:O}, panel {panel.Count} người."
        });

        // Email xác nhận + .ics (best-effort).
        await _notify.SendInterviewConfirmedAsync(companyId, applicationId, dto.StartTime);

        _logger.Information("Scheduling: chốt lịch tay schedule={ScheduleId} app={AppId} vòng {Round} panel={Panel}.",
            scheduleId, applicationId, round, panel.Count);

        return scheduleId;
    }

    // ============================================================

    private async Task<PoolDto> BuildPoolDtoAsync(
        long companyId, InterviewSlotPool pool, IReadOnlyList<InterviewSlot>? slots = null)
    {
        slots ??= await _schedulingRepo.GetSlotsByPoolAsync(companyId, pool.PoolId, onlyOpenFuture: false);
        var schedules = await _schedulingRepo.GetSchedulesByPoolAsync(companyId, pool.PoolId);

        // Gom mọi interviewer_id trong panel các khung để fetch tên 1 lần (tránh N+1).
        var allIds = slots.SelectMany(s => s.Interviewers.Select(i => i.InterviewerId))
                          .Distinct()
                          .ToList();
        var userMap = (await _userRepo.GetNamesByIdsAsync(companyId, allIds))
            .ToDictionary(u => u.UserId, u => u);

        var invited = new List<InvitedCandidateDto>(schedules.Count);
        foreach (var s in schedules)
        {
            var noSlot = await _schedulingRepo.CountNoSlotFitsAsync(companyId, s.ApplicationId);
            invited.Add(new InvitedCandidateDto
            {
                ScheduleId = s.ScheduleId,
                ApplicationId = s.ApplicationId,
                Status = s.Status,
                ConfirmedSlotId = s.ConfirmedSlotId,
                NoSlotFitsCount = noSlot,
                Flag = SchedulingFlag.From(noSlot)
            });
        }

        return new PoolDto
        {
            PoolId = pool.PoolId,
            JobId = pool.JobId,
            RoundNumber = pool.RoundNumber,
            Status = pool.Status,
            Slots = slots.Select(x => new SlotDto
            {
                SlotId = x.SlotId,
                StartTime = x.StartTime,
                Status = x.Status,
                BookedApplicationId = x.BookedApplicationId,
                Interviewers = x.Interviewers.Select(i => new InterviewerMiniDto
                {
                    InterviewerId = i.InterviewerId,
                    FullName = userMap.TryGetValue(i.InterviewerId, out var u) ? (u.FullName ?? u.Email ?? $"#{i.InterviewerId}") : $"#{i.InterviewerId}",
                    Email = userMap.TryGetValue(i.InterviewerId, out var u2) ? u2.Email : null
                }).ToList()
            }).ToList(),
            InvitedCandidates = invited
        };
    }

    /// <summary>
    /// Validate bộ khung: ≥1 khung, mỗi khung có 1..MaxPanelSize interviewer (không trùng) + thời điểm tương lai.
    /// </summary>
    private static void ValidateSlots(List<SlotInputDto>? slots)
    {
        if (slots is null || slots.Count == 0)
            throw Bad("Phải mở ít nhất 1 khung giờ.");

        var now = DateTime.UtcNow;
        foreach (var s in slots)
        {
            if (s.InterviewerIds is null || s.InterviewerIds.Count == 0)
                throw Bad("Mỗi khung phải có ít nhất 1 interviewer trong panel.");
            if (s.InterviewerIds.Count > MaxPanelSize)
                throw Bad($"Mỗi khung tối đa {MaxPanelSize} interviewer trong panel.");
            if (s.InterviewerIds.Any(id => id <= 0))
                throw Bad("Panel có interviewer không hợp lệ (id <= 0).");
            if (s.InterviewerIds.Distinct().Count() != s.InterviewerIds.Count)
                throw Bad("Panel có interviewer bị trùng trong cùng 1 khung.");
            if (s.StartTime <= now)
                throw Bad("Khung giờ phải ở tương lai.");
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
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
