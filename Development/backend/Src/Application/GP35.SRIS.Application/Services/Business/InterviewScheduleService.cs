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
/// Đặt lịch phỏng vấn — bộ phận nhân sự (docs Section 15, viết lại 15/08/2026).
///
/// Mô hình cũ (pool khung dùng chung + magic link SCHEDULE cho ứng viên tự chọn) ĐÃ BỎ: nhân sự
/// phải ngồi đợi ứng viên bấm link, trong khi một cuộc gọi là chốt xong. Giờ nhân sự hỏi lịch
/// rảnh của người phỏng vấn, gọi ứng viên thống nhất giờ, rồi NHẬP buổi vào hệ thống — hệ thống
/// lo phần còn lại: chống trùng giờ, email xác nhận + .ics, và tạo bản ghi để interviewer chấm.
///
/// Lưu trữ giữ nguyên hình dạng cũ (pool 1 khung CLOSED + slot BOOKED + schedule CONFIRMED) nên
/// phiếu chấm, tổng hợp điểm và màn hình của interviewer không phải đổi gì.
/// </summary>
public class InterviewScheduleService : BaseService<InterviewScheduleService>, IInterviewScheduleService
{
    /// <summary>Độ dài tối đa tên vòng — khớp cột NVARCHAR(120) ở V041.</summary>
    private const int MaxRoundNameLength = 120;

    /// <summary>Trần khoảng xem lịch bận của người phỏng vấn (V047) — form chỉ cần vài tuần.</summary>
    private static readonly TimeSpan MaxBusyWindow = TimeSpan.FromDays(31);

    private readonly IApplicationRepo _appRepo;
    private readonly ISchedulingRepo _schedulingRepo;
    private readonly IEvaluationCriteriaRepo _criteriaRepo;
    private readonly IUserRepo _userRepo;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly INotificationService _notify;
    private readonly ILogger _logger;

    public InterviewScheduleService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _schedulingRepo = serviceProvider.GetRequiredService<ISchedulingRepo>();
        _criteriaRepo = serviceProvider.GetRequiredService<IEvaluationCriteriaRepo>();
        _userRepo = serviceProvider.GetRequiredService<IUserRepo>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _notify = serviceProvider.GetRequiredService<INotificationService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<InterviewScheduleService>();
    }

    public async Task<long> BookAsync(long companyId, long userId, long applicationId, BookInterviewDto dto)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        // Nhân sự LÊN LỊCH, không CHỌN người: hồ sơ phải được Trưởng bộ phận duyệt vào vòng
        // phỏng vấn trước (docs 5.8).
        if (!string.Equals(app.CurrentState, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase))
            throw Conflict(NotApprovedReason(app.CurrentState));

        // MỌI validate chạy TRƯỚC khi ghi: buổi đã tạo mà báo lỗi sau là để lại một buổi rác.
        await EnsureJobHasApprovedCriteriaAsync(companyId, app.JobId);

        if (dto.InterviewerIds is null || dto.InterviewerIds.Count == 0)
            throw Bad("Phải chọn ít nhất 1 người phỏng vấn.");
        if (dto.InterviewerIds.Count > InterviewPanel.MaxSize)
            throw Bad($"Tối đa {InterviewPanel.MaxSize} người phỏng vấn cho một buổi.");
        if (dto.InterviewerIds.Distinct().Count() != dto.InterviewerIds.Count)
            throw Bad("Danh sách người phỏng vấn bị trùng.");

        await EnsureInterviewersAssignedAsync(companyId, applicationId, dto.InterviewerIds);

        // FE gửi giờ NGƯỜI DÙNG CHỌN dạng local naive (không 'Z'), nên so với giờ LOCAL của
        // server. So với UtcNow là lệch đúng bằng offset múi giờ (VN: +7) -> buổi 09:00 sáng nay
        // lúc 15:00 chiều vẫn lọt qua vì 09:00 > 08:00 UTC.
        if (dto.StartTime <= DateTime.Now)
            throw Bad($"Thời điểm {dto.StartTime:HH:mm dd/MM/yyyy} đã ở quá khứ " +
                      $"(bây giờ là {DateTime.Now:HH:mm dd/MM/yyyy}). Hãy chọn thời điểm sau hiện tại.");

        // Vòng đếm theo CHÍNH ứng viên (max vòng đã có + 1): người vào sau, buổi đầu tiên của họ
        // vẫn là vòng 1. Bỏ trống = tự ++ (FE luôn bỏ trống); truyền tay thì không được nhảy cóc.
        var nextRound = await _schedulingRepo.GetNextRoundNumberAsync(companyId, applicationId);
        var round = dto.RoundNumber ?? nextRound;
        if (round < 1)
            throw Bad("Vòng phỏng vấn phải từ 1 trở lên.");
        if (round > nextRound)
            throw Bad(nextRound == 1
                ? $"Ứng viên này chưa có buổi phỏng vấn nào — buổi đầu tiên là vòng 1, không phải vòng {round}."
                : $"Ứng viên này mới phỏng vấn tới vòng {nextRound - 1}. Vòng phải tăng dần — " +
                  $"buổi tiếp theo là vòng {nextRound}, không nhảy thẳng sang vòng {round}.");

        if (await _schedulingRepo.HasConfirmedScheduleForRoundAsync(companyId, applicationId, round))
            throw Conflict($"Ứng viên đã có buổi phỏng vấn vòng {round}. " +
                           "Muốn phỏng vấn thêm thì đặt buổi cho vòng kế tiếp.");

        var panel = dto.InterviewerIds.Distinct().ToList();

        // Chỉ chặn TRÙNG ĐÚNG GIỜ (18/08/2026 — bỏ luật cách nhau 1 tiếng, xem InterviewTiming):
        // giờ đã được nhân sự gọi điện chốt với cả hai bên, và buổi 30 phút xong là mời người
        // kế tiếp vào luôn. Cái duy nhất vẫn vô lý là một người bắt đầu hai buổi cùng lúc.
        var myBusyAt = await _schedulingRepo.FindCandidateBusyAtAsync(
            companyId, applicationId, dto.StartTime, InterviewTiming.MinGap, excludeScheduleId: 0);
        if (myBusyAt is DateTime busyAt)
            throw Conflict(
                $"Ứng viên đã có buổi phỏng vấn đúng lúc {busyAt:HH:mm dd/MM/yyyy} — " +
                "chọn giờ khác cho buổi này.");

        var busy = await _schedulingRepo.FindBusyInterviewerAsync(
            companyId, panel, dto.StartTime, InterviewTiming.MinGap, excludeSlotId: 0);
        if (busy is not null)
        {
            var name = (await _userRepo.GetNamesByIdsAsync(companyId, new List<long> { busy.InterviewerId }))
                .Select(u => u.FullName ?? u.Email)
                .FirstOrDefault() ?? $"#{busy.InterviewerId}";
            throw Conflict(
                $"{name} đã có buổi phỏng vấn đúng lúc {busy.StartTime:HH:mm dd/MM/yyyy} — " +
                "chọn giờ khác hoặc bỏ người này khỏi buổi.");
        }

        var scheduleId = await _schedulingRepo.ManualConfirmAsync(
            companyId, app.JobId, applicationId, panel, dto.StartTime, round,
            Normalize(dto.Name), userId > 0 ? userId : null);

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "INTERVIEW_SCHEDULED",
            Detail = $"Vòng {round}, {dto.StartTime:HH:mm dd/MM/yyyy}, {panel.Count} người phỏng vấn."
        });

        // Email xác nhận + .ics (best-effort — email hỏng không được làm rớt buổi đã đặt).
        await _notify.SendInterviewConfirmedAsync(companyId, applicationId, dto.StartTime);

        _logger.Information("Scheduling: đặt buổi schedule={ScheduleId} app={AppId} vòng {Round} panel={Panel}.",
            scheduleId, applicationId, round, panel.Count);

        return scheduleId;
    }

    public async Task<IReadOnlyList<InterviewSessionDto>> GetByJobAsync(long companyId, long jobId)
    {
        var rows = await _schedulingRepo.GetSchedulesByJobAsync(companyId, jobId);
        if (rows.Count == 0) return Array.Empty<InterviewSessionDto>();

        // Lấy panel + tên người phỏng vấn của TẤT CẢ buổi trong 2 lượt truy vấn (tránh N+1).
        var panels = await _schedulingRepo.GetPanelsBySlotIdsAsync(
            companyId, rows.Select(r => r.SlotId).Distinct().ToList());
        var allInterviewerIds = panels.Values.SelectMany(v => v).Distinct().ToList();
        var userMap = (await _userRepo.GetNamesByIdsAsync(companyId, allInterviewerIds))
            .ToDictionary(u => u.UserId, u => u);

        return rows.Select(r => new InterviewSessionDto
        {
            ScheduleId = r.ScheduleId,
            ApplicationId = r.ApplicationId,
            CandidateName = r.CandidateName,
            CandidateEmail = r.CandidateEmail,
            RoundNumber = r.RoundNumber,
            RoundName = r.RoundName,
            StartTime = r.StartTime,
            Status = r.Status,
            ApplicationState = r.ApplicationState,
            Interviewers = (panels.TryGetValue(r.SlotId, out var ids) ? ids : new List<long>())
                .Select(id => new InterviewerMiniDto
                {
                    InterviewerId = id,
                    FullName = userMap.TryGetValue(id, out var u)
                        ? (u.FullName ?? u.Email ?? $"#{id}")
                        : $"#{id}",
                    Email = userMap.TryGetValue(id, out var u2) ? u2.Email : null
                })
                .ToList()
        }).ToList();
    }

    public async Task<IReadOnlyList<InterviewerBusySlotDto>> GetInterviewerBusyAsync(
        long companyId, IReadOnlyList<long> interviewerIds, DateTime fromUtc, DateTime toUtc)
    {
        var ids = interviewerIds.Distinct().Where(id => id > 0).ToList();
        if (ids.Count == 0 || toUtc <= fromUtc) return Array.Empty<InterviewerBusySlotDto>();

        // Trần cửa sổ: form đặt lịch chỉ nhìn quanh ngày đang chọn, mở rộng vô hạn thì một
        // lần bấm kéo về cả lịch sử phỏng vấn của công ty.
        if (toUtc - fromUtc > MaxBusyWindow) toUtc = fromUtc + MaxBusyWindow;

        var rows = await _schedulingRepo.GetInterviewerBusySlotsAsync(companyId, ids, fromUtc, toUtc);
        if (rows.Count == 0) return Array.Empty<InterviewerBusySlotDto>();

        var userMap = (await _userRepo.GetNamesByIdsAsync(companyId, ids))
            .ToDictionary(u => u.UserId, u => u);

        return rows.Select(r => new InterviewerBusySlotDto
        {
            InterviewerId = r.InterviewerId,
            InterviewerName = userMap.TryGetValue(r.InterviewerId, out var u)
                ? (u.FullName ?? u.Email ?? $"#{r.InterviewerId}")
                : $"#{r.InterviewerId}",
            StartTime = r.StartTime,
            EndTime = r.EndTime,
            CandidateName = r.CandidateName
        }).ToList();
    }

    public async Task CancelAsync(long companyId, long userId, long scheduleId, CancelInterviewDto dto)
    {
        var schedule = await _schedulingRepo.GetScheduleByIdAsync(companyId, scheduleId)
            ?? throw NotFound($"Không tìm thấy buổi phỏng vấn (schedule_id={scheduleId}).");

        // Lấy giờ buổi TRƯỚC khi hủy — hủy xong khung bị khóa, email báo ứng viên vẫn phải nói
        // đúng buổi nào bị hủy.
        DateTime? start = null;
        if (schedule.ConfirmedSlotId is long slotId)
            start = (await _schedulingRepo.GetSlotAsync(companyId, slotId))?.StartTime;

        // Một buổi = một pool 1 khung, nên hủy pool là hủy đúng buổi đó (không đụng buổi khác).
        if (schedule.PoolId is not long poolId)
            throw Conflict("Buổi phỏng vấn này không gắn với khung giờ nào — không hủy được.");

        var cancelled = await _schedulingRepo.CancelPoolAsync(companyId, poolId);
        if (!cancelled)
            throw Conflict("Buổi phỏng vấn này đã bị hủy trước đó.");

        var reason = Normalize(dto.Reason);

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = schedule.ApplicationId,
            UserId = userId > 0 ? userId : null,
            Action = "INTERVIEW_CANCELLED",
            Detail = reason is null
                ? $"Hủy buổi vòng {schedule.RoundNumber}."
                : $"Hủy buổi vòng {schedule.RoundNumber}. Lý do: {reason}"
        });

        await _notify.SendInterviewCancelledAsync(companyId, schedule.ApplicationId, start, reason);

        _logger.Information("Scheduling: hủy buổi schedule={ScheduleId} app={AppId}.",
            scheduleId, schedule.ApplicationId);
    }

    // ============================================================

    /// <summary>
    /// Không đặt lịch phỏng vấn khi job chưa có tiêu chí DÙNG ĐƯỢC. Điều kiện đúng bằng filter của
    /// phiếu chấm (<c>activeOnly + approvedOnly</c> — xem InterviewScoringService): job chỉ có tiêu
    /// chí DRAFT do AI vừa bóc thì interviewer vẫn mở ra phiếu trống 0/0.
    /// </summary>
    private async Task EnsureJobHasApprovedCriteriaAsync(long companyId, long jobId)
    {
        var usable = await _criteriaRepo.GetByJobAsync(companyId, jobId, activeOnly: true);
        if (usable.Count > 0) return;

        // Chỉ chạy ở nhánh lỗi: phân biệt "chưa bóc" với "bóc rồi nhưng chưa duyệt" để
        // người dùng biết phải bấm gì tiếp.
        var all = await _criteriaRepo.GetByJobAsync(companyId, jobId, activeOnly: false, approvedOnly: false);

        throw Conflict(all.Count == 0
            ? "Tin tuyển dụng này chưa có tiêu chí đánh giá nào. Hãy bóc tiêu chí bằng AI (hoặc " +
              "nhập tay) và duyệt trước khi đặt lịch phỏng vấn — nếu không interviewer sẽ nhận " +
              "phiếu chấm trống."
            : $"Tin tuyển dụng này có {all.Count} tiêu chí nhưng chưa cái nào được duyệt và đang bật. " +
              "Hãy duyệt tiêu chí trước khi đặt lịch phỏng vấn — phiếu chấm chỉ hiện tiêu chí " +
              "đã duyệt.");
    }

    /// <summary>
    /// Nhân sự chốt GIỜ, Trưởng bộ phận chốt NGƯỜI (V045 — chốt 16/08/2026). Panel của buổi phải
    /// nằm trọn trong danh sách DM đã chỉ định cho chính ứng viên này.
    ///
    /// Trước V045 nhân sự truyền id tùy ý, tức là họ đang quyết cả "ai gặp ai" — quyết định
    /// chuyên môn không thuộc về họ. Đừng nới lại thành "gợi ý": danh sách chỉ chặn được khi nó
    /// là ràng buộc.
    /// </summary>
    private async Task EnsureInterviewersAssignedAsync(
        long companyId, long applicationId, IReadOnlyList<long> requested)
    {
        var assigned = await _schedulingRepo.GetAssignedInterviewersAsync(companyId, applicationId);

        if (assigned.Count == 0)
            throw Conflict(
                "Trưởng bộ phận chưa chỉ định người phỏng vấn cho ứng viên này. Hãy đề nghị họ " +
                "chọn người phỏng vấn ở màn Duyệt Ứng Viên Vào Phỏng Vấn, hồ sơ sẽ xếp lịch được ngay.");

        var outsiders = requested.Where(id => !assigned.Contains(id)).ToList();
        if (outsiders.Count == 0) return;

        // Gọi tên người bị từ chối — "có người không hợp lệ" bắt nhân sự đoán xem là ai trong 5 ô.
        var names = (await _userRepo.GetNamesByIdsAsync(companyId, outsiders))
            .Select(u => u.FullName ?? u.Email)
            .ToList();
        var who = names.Count > 0 ? string.Join(", ", names) : string.Join(", ", outsiders);

        throw Conflict(
            $"{who} không nằm trong danh sách người phỏng vấn Trưởng bộ phận chỉ định cho ứng " +
            "viên này. Muốn đổi người thì Trưởng bộ phận cập nhật danh sách trước.");
    }

    /// <summary>
    /// Lý do không đặt lịch được, nói theo chỗ hồ sơ ĐANG đứng. Hồ sơ đã chốt (HIRED/REJECTED)
    /// khác hẳn hồ sơ mới/đang sàng lọc — gộp chung một câu "chưa được duyệt" thì nhân sự
    /// đi hỏi Trưởng bộ phận duyệt một hồ sơ đã đóng.
    /// </summary>
    private static string NotApprovedReason(string? currentState) =>
        string.Equals(currentState, ApplicationState.Hired, StringComparison.OrdinalIgnoreCase)
            ? "Ứng viên đã được tuyển — không xếp lịch phỏng vấn nữa."
        : string.Equals(currentState, ApplicationState.Rejected, StringComparison.OrdinalIgnoreCase)
            ? "Hồ sơ đã bị loại — không xếp lịch phỏng vấn nữa."
        : string.Equals(currentState, ApplicationState.Offer, StringComparison.OrdinalIgnoreCase)
            ? "Hồ sơ đã sang bước ra quyết định — không xếp thêm buổi phỏng vấn."
        : "Hồ sơ chưa được Trưởng bộ phận duyệt vào vòng phỏng vấn — chỉ xếp lịch được sau khi duyệt.";

    /// <summary>Cắt khoảng trắng tên vòng + chặn quá dài. Chuỗi rỗng -> null (= không đặt tên).</summary>
    private static string? Normalize(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        if (trimmed.Length > MaxRoundNameLength)
            throw Bad($"Tên vòng tối đa {MaxRoundNameLength} ký tự.");
        return trimmed;
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
