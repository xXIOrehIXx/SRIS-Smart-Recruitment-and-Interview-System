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
/// Đặt lịch phỏng vấn theo POOL dùng chung — Human Resource (Section 15). Ai chốt trước lấy trước;
/// các khung khác giữ OPEN cho người sau.
///
/// MỜI = hồ sơ đã sang bước Phỏng vấn: service tự đẩy state tới INTERVIEW (đi từng bước, có
/// ActivityLog) thay vì bắt Human Resource sang Kanban kéo card trước rồi mới mời được.
///
/// Mở rộng A: mỗi khung có 1..N interviewer (panel) — Human Resource có thể chọn 3–5 người cùng dự buổi phỏng vấn.
/// </summary>
public class InterviewPoolService : BaseService<InterviewPoolService>, IInterviewPoolService
{
    /// <summary>Số interviewer tối đa trong 1 panel khung.</summary>
    private const int MaxPanelSize = 5;

    /// <summary>Độ dài tối đa tên vòng — khớp cột NVARCHAR(120) ở V041.</summary>
    private const int MaxRoundNameLength = 120;

    private readonly IApplicationRepo _appRepo;
    private readonly ISchedulingRepo _schedulingRepo;
    private readonly IEvaluationCriteriaRepo _criteriaRepo;
    private readonly IUserRepo _userRepo;
    private readonly IMagicLinkService _magicLink;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly INotificationService _notify;
    private readonly ILogger _logger;

    public InterviewPoolService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _schedulingRepo = serviceProvider.GetRequiredService<ISchedulingRepo>();
        _criteriaRepo = serviceProvider.GetRequiredService<IEvaluationCriteriaRepo>();
        _userRepo = serviceProvider.GetRequiredService<IUserRepo>();
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _notify = serviceProvider.GetRequiredService<INotificationService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<InterviewPoolService>();
    }

    public async Task<PoolDto> CreatePoolAsync(long companyId, long userId, long jobId, CreatePoolDto dto)
    {
        // Chặn NGAY ở cửa đầu: chưa có tiêu chí thì đừng để recruiter mất công chọn khung + panel.
        await EnsureJobHasApprovedCriteriaAsync(companyId, jobId);

        ValidateSlots(dto.Slots);

        var poolsWithSlots = await _schedulingRepo.GetPoolsByJobAsync(companyId, jobId);
        var poolsOfJob = poolsWithSlots.Select(p => p.Pool).ToList();

        // Các vòng của một VỊ TRÍ là một dãy liên tục 1,2,3... (đúng mô hình "interview plan"
        // của các ATS thật): số vòng do hệ thống đánh, người dùng chỉ đặt TÊN. Vòng đã hủy
        // không tính — hủy rồi mở lại đúng vòng đó là chuyện bình thường.
        var maxRound = poolsOfJob
            .Where(p => !string.Equals(p.Status, InterviewPoolStatus.Cancelled, StringComparison.OrdinalIgnoreCase))
            .Select(p => p.RoundNumber)
            .DefaultIfEmpty(0)
            .Max();

        // Bỏ trống = vòng KẾ TIẾP. Truyền số của vòng ĐÃ CÓ = mở thêm đợt khung cho vòng đó —
        // đây là đường dành cho ứng viên nộp muộn: họ vẫn phải qua vòng 1 dù người khác đã
        // sang vòng 3. Chỉ chặn nhảy cóc quá vòng kế tiếp (dãy vòng thủng lỗ 1 rồi 5).
        var roundNumber = dto.RoundNumber ?? maxRound + 1;
        if (roundNumber < 1)
            throw Bad("Vòng phỏng vấn phải từ 1 trở lên.");
        if (roundNumber > maxRound + 1)
            throw Bad(maxRound == 0
                ? $"Vị trí này chưa có vòng phỏng vấn nào — vòng đầu tiên phải là vòng 1, không phải vòng {roundNumber}."
                : $"Vị trí này mới có tới vòng {maxRound}. Vòng phải tăng dần — mở vòng {maxRound + 1} trước, " +
                  $"không nhảy thẳng sang vòng {roundNumber}.");

        // Một job chỉ được có 1 pool ĐANG MỞ cho mỗi vòng: mở hai pool cùng "vòng 1" thì
        // ứng viên nhận hai lời mời cho cùng một vòng và recruiter không biết khung nào là thật.
        // Chỉ chặn khi pool cũ còn OPEN — pool đã đóng/hủy thì mở lại cùng vòng là hợp lệ
        // (đúng với thông báo "Pool không còn mở — hãy tạo pool mới" ở luồng mời).
        var existingOpen = poolsOfJob
            .FirstOrDefault(p =>
                p.RoundNumber == roundNumber &&
                string.Equals(p.Status, InterviewPoolStatus.Open, StringComparison.OrdinalIgnoreCase));

        if (existingOpen is not null)
            throw Conflict(
                $"Vòng {roundNumber} của tin tuyển dụng này đã có đợt khung đang mở " +
                $"(pool #{existingOpen.PoolId}). Hãy mời ứng viên vào đợt đó, hủy nó, " +
                $"hoặc mở vòng {maxRound + 1}.");

        // Vòng sau phải diễn ra SAU vòng trước. Mốc so sánh là khung MUỘN NHẤT của vòng liền
        // trước, vì bất kỳ ứng viên nào cũng có thể đã đặt đúng khung muộn nhất đó — mở vòng 2
        // sớm hơn mốc ấy là bày ra khả năng phỏng vấn vòng 2 trước khi vòng 1 diễn ra.
        // Chỉ áp khi mở vòng MỚI; mở lại vòng cũ cho ứng viên nộp muộn không bị chặn (vòng 1
        // của họ đương nhiên nằm sau các vòng đang chạy của người khác).
        if (roundNumber > 1)
        {
            var prevLatest = poolsWithSlots
                .Where(pw => pw.Pool.RoundNumber == roundNumber - 1
                    && !string.Equals(pw.Pool.Status, InterviewPoolStatus.Cancelled, StringComparison.OrdinalIgnoreCase))
                .SelectMany(pw => pw.Slots)
                .Where(s => !string.Equals(s.Status, InterviewSlotStatus.Locked, StringComparison.OrdinalIgnoreCase))
                .Select(s => (DateTime?)s.StartTime)
                .Max();

            if (prevLatest is DateTime prev)
            {
                var tooEarly = dto.Slots
                    .Where(s => s.StartTime <= prev)
                    .OrderBy(s => s.StartTime)
                    .FirstOrDefault();

                if (tooEarly is not null)
                    throw Bad(
                        $"Vòng {roundNumber} phải diễn ra sau vòng {roundNumber - 1}. Khung muộn nhất của " +
                        $"vòng {roundNumber - 1} là {prev:HH:mm dd/MM/yyyy}, nhưng khung " +
                        $"{tooEarly.StartTime:HH:mm dd/MM/yyyy} lại sớm hơn mốc đó.");
            }
        }

        // Tên vòng: kế thừa tên đã đặt cho CHÍNH vòng đó lần trước khi mở lại (ứng viên nộp
        // muộn phải thấy đúng "Vòng 1 · Phỏng vấn sơ bộ", không phải một vòng 1 vô danh).
        var name = Normalize(dto.Name)
                   ?? poolsOfJob.Where(p => p.RoundNumber == roundNumber)
                                .Select(p => p.Name)
                                .FirstOrDefault(n => !string.IsNullOrWhiteSpace(n));

        var pool = new InterviewSlotPool
        {
            JobId = jobId,
            RoundNumber = roundNumber,
            Name = name,
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

        // Cửa cam kết thật (ứng viên nhận email). Check lại vì pool có thể tạo trước khi có rule này,
        // hoặc tiêu chí bị tắt/xóa sau khi pool đã mở.
        await EnsureJobHasApprovedCriteriaAsync(companyId, pool.JobId);

        var result = new InviteResultDto();
        foreach (var applicationId in (dto.ApplicationIds ?? new()).Distinct())
        {
            var app = await _appRepo.GetByIdAsync(companyId, applicationId);
            if (app is null)
            {
                result.Skipped.Add(new InviteSkippedDto { ApplicationId = applicationId, Reason = "Không tìm thấy hồ sơ." });
                continue;
            }
            // Bỏ qua NGAY nếu không mời được — check TRƯỚC khi đẩy state, để hồ sơ bị skip không bị
            // đẩy sang INTERVIEW rồi bỏ đó (state đã đổi mà không có lịch nào).
            if (await _schedulingRepo.HasActiveInviteInPoolAsync(companyId, poolId, applicationId))
            {
                result.Skipped.Add(new InviteSkippedDto { ApplicationId = applicationId, Reason = "Đã mời vào pool này rồi." });
                continue;
            }
            if (await _schedulingRepo.HasConfirmedScheduleForRoundAsync(companyId, applicationId, pool.RoundNumber))
            {
                result.Skipped.Add(new InviteSkippedDto
                {
                    ApplicationId = applicationId,
                    Reason = $"Đã chốt lịch vòng {pool.RoundNumber} rồi — mời tiếp sẽ thành 2 buổi cùng vòng. " +
                             "Muốn phỏng vấn thêm thì mở pool vòng kế tiếp."
                });
                continue;
            }

            // Human Resource LÊN LỊCH, không CHỌN người: hồ sơ phải được Trưởng bộ phận duyệt
            // sang bước Phỏng vấn trước thì mới mời được (chốt sau bảo vệ 15/08/2026). Trước đây
            // chỗ này tự đẩy state — mời ai là mặc nhiên chọn người đó, đúng thứ vừa bị bỏ.
            if (!string.Equals(app.CurrentState, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase))
            {
                result.Skipped.Add(new InviteSkippedDto
                {
                    ApplicationId = applicationId,
                    Reason = NotApprovedReason(app.CurrentState)
                });
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

        // Cùng luật với mời qua pool: chỉ chốt lịch cho hồ sơ Trưởng bộ phận ĐÃ duyệt vào
        // vòng phỏng vấn. Nhánh gọi điện cũng là lên lịch, không phải cửa chọn người.
        if (!string.Equals(app.CurrentState, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase))
            throw Conflict(NotApprovedReason(app.CurrentState));

        await EnsureJobHasApprovedCriteriaAsync(companyId, app.JobId);

        if (dto.InterviewerIds is null || dto.InterviewerIds.Count == 0)
            throw Bad("Phải chọn ít nhất 1 interviewer cho panel.");
        if (dto.InterviewerIds.Count > MaxPanelSize)
            throw Bad($"Panel tối đa {MaxPanelSize} interviewer.");
        if (dto.InterviewerIds.Distinct().Count() != dto.InterviewerIds.Count)
            throw Bad("Panel có interviewer bị trùng.");
        // Giờ chốt tay cũng là local naive từ FE -> so với giờ local server (xem ValidateSlots).
        if (dto.StartTime <= DateTime.Now)
            throw Bad($"Thời điểm {dto.StartTime:HH:mm dd/MM/yyyy} đã ở quá khứ " +
                      $"(bây giờ là {DateTime.Now:HH:mm dd/MM/yyyy}). Hãy chọn thời điểm sau hiện tại.");

        // Vòng của chốt tay đếm theo CHÍNH ứng viên (max vòng đã có + 1), không theo vị trí:
        // người vào sau chốt tay buổi đầu tiên vẫn là vòng 1 của họ. Bỏ trống = tự ++ (FE luôn
        // bỏ trống); truyền tay thì vẫn không được nhảy cóc.
        var nextRound = await _schedulingRepo.GetNextRoundNumberAsync(companyId, applicationId);
        var round = dto.RoundNumber ?? nextRound;
        if (round < 1)
            throw Bad("Vòng phỏng vấn phải từ 1 trở lên.");
        if (round > nextRound)
            throw Bad(nextRound == 1
                ? $"Ứng viên này chưa có buổi phỏng vấn nào — buổi đầu tiên là vòng 1, không phải vòng {round}."
                : $"Ứng viên này mới phỏng vấn tới vòng {nextRound - 1}. Vòng phải tăng dần — " +
                  $"buổi tiếp theo là vòng {nextRound}, không nhảy thẳng sang vòng {round}.");

        var panel = dto.InterviewerIds.Distinct().ToList();

        // Chống trùng như nhánh ứng viên tự chốt (không có schedule cũ để loại trừ -> 0).
        var myBusyAt = await _schedulingRepo.FindCandidateBusyAtAsync(
            companyId, applicationId, dto.StartTime, InterviewTiming.MinGap, excludeScheduleId: 0);
        if (myBusyAt is DateTime busyAt)
            throw Conflict(
                $"Ứng viên đã có buổi phỏng vấn lúc {busyAt:HH:mm dd/MM/yyyy}. " +
                $"Hai buổi phải cách nhau ít nhất {InterviewTiming.MinGapHours} tiếng.");

        var busy = await _schedulingRepo.FindBusyInterviewerAsync(
            companyId, panel, dto.StartTime, InterviewTiming.MinGap, excludeSlotId: 0);
        if (busy is not null)
            throw Conflict(
                $"Interviewer #{busy.InterviewerId} đã có buổi lúc {busy.StartTime:HH:mm dd/MM/yyyy} — " +
                $"các buổi phải cách nhau ít nhất {InterviewTiming.MinGapHours} tiếng.");

        var scheduleId = await _schedulingRepo.ManualConfirmAsync(
            companyId, app.JobId, applicationId, panel, dto.StartTime, round,
            Normalize(dto.Name) ?? "Chốt lịch tay",
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

    /// <summary>
    /// Không mở lịch phỏng vấn khi job chưa có tiêu chí DÙNG ĐƯỢC. Điều kiện đúng bằng filter của
    /// phiếu chấm (<c>activeOnly + approvedOnly</c> — xem InterviewScoringService): job chỉ có tiêu
    /// chí DRAFT do AI vừa bóc thì interviewer vẫn mở ra phiếu trống 0/0. Chặn ở tạo pool / mời /
    /// chốt tay — cả ba cửa dẫn tới một buổi phỏng vấn có thật.
    /// </summary>
    private async Task EnsureJobHasApprovedCriteriaAsync(long companyId, long jobId)
    {
        var usable = await _criteriaRepo.GetByJobAsync(companyId, jobId, activeOnly: true);
        if (usable.Count > 0) return;

        // Chỉ chạy ở nhánh lỗi: phân biệt "chưa bóc" với "bóc rồi nhưng chưa duyệt" để
        // recruiter biết phải bấm gì tiếp.
        var all = await _criteriaRepo.GetByJobAsync(companyId, jobId, activeOnly: false, approvedOnly: false);

        throw Conflict(all.Count == 0
            ? "Tin tuyển dụng này chưa có tiêu chí đánh giá nào. Hãy bóc tiêu chí bằng AI (hoặc " +
              "nhập tay) và duyệt trước khi mở lịch phỏng vấn — nếu không interviewer sẽ nhận " +
              "phiếu chấm trống."
            : $"Tin tuyển dụng này có {all.Count} tiêu chí nhưng chưa cái nào được duyệt và đang bật. " +
              "Hãy duyệt tiêu chí trước khi mở lịch phỏng vấn — phiếu chấm chỉ hiện tiêu chí " +
              "đã duyệt.");
    }

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
            Name = pool.Name,
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

        // FE gửi giờ NGƯỜI DÙNG CHỌN dạng local naive (không 'Z' — xem comment ở
        // InterviewScheduleRecruit.jsx), nên phải so với giờ LOCAL của server. So với UtcNow
        // là lệch đúng bằng offset múi giờ (VN: +7) -> khung 09:00 sáng nay lúc 15:00 chiều
        // vẫn lọt qua vì 09:00 > 08:00 UTC.
        var now = DateTime.Now;
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
            // Nói rõ khung NÀO và bây giờ là mấy giờ. Câu "Khung giờ phải ở tương lai" trống trơn
            // khiến người dùng đi tìm nguyên nhân ở chỗ khác (vòng cũ đã hủy, pool trùng...)
            // trong khi lý do chỉ là cái đồng hồ — hay gặp nhất là chọn ngày hôm nay mà để
            // nguyên 00:00 mặc định của ô chọn giờ.
            if (s.StartTime <= now)
                throw Bad($"Khung {s.StartTime:HH:mm dd/MM/yyyy} đã ở quá khứ " +
                          $"(bây giờ là {now:HH:mm dd/MM/yyyy}). Hãy chọn thời điểm sau hiện tại.");
        }
    }

    /// <summary>Cắt khoảng trắng tên vòng + chặn quá dài. Chuỗi rỗng -> null (= không đặt tên).</summary>
    private static string? Normalize(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > MaxRoundNameLength)
            throw Bad($"Tên vòng tối đa {MaxRoundNameLength} ký tự.");
        return trimmed;
    }

    /// <summary>
    /// Lý do không lên lịch được, nói theo chỗ hồ sơ ĐANG đứng. Hồ sơ đã chốt (HIRED/REJECTED)
    /// khác hẳn hồ sơ mới/đang sàng lọc — gộp chung một câu "chưa được duyệt" thì Human Resource
    /// đi hỏi Trưởng bộ phận duyệt một hồ sơ đã bị loại.
    /// </summary>
    private static string NotApprovedReason(string? currentState) =>
        string.Equals(currentState, ApplicationState.Hired, StringComparison.OrdinalIgnoreCase)
            ? "Ứng viên đã được tuyển — không xếp lịch phỏng vấn nữa."
        : string.Equals(currentState, ApplicationState.Rejected, StringComparison.OrdinalIgnoreCase)
            ? "Hồ sơ đã bị loại — không xếp lịch phỏng vấn nữa."
        : string.Equals(currentState, ApplicationState.Offer, StringComparison.OrdinalIgnoreCase)
            ? "Hồ sơ đã sang bước ra quyết định — không xếp thêm buổi phỏng vấn."
        : "Hồ sơ chưa được Trưởng bộ phận duyệt vào vòng phỏng vấn — chỉ xếp lịch được sau khi duyệt.";

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
