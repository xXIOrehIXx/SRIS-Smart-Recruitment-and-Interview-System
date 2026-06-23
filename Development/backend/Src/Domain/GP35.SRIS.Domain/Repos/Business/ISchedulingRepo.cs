using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 lịch phỏng vấn (1 vòng) kèm các khung giờ của nó.</summary>
public record ScheduleWithSlots(InterviewSchedule Schedule, IReadOnlyList<InterviewSlot> Slots);

/// <summary>1 người trong cuộc (recruiter / interviewer) để gửi lời mời lịch.</summary>
public record InterviewParticipant(string Email, string? Name);

/// <summary>
/// Người trong cuộc của buổi PV đã chốt (Đường A — gửi .ics cho cả nhóm). RoundNumber + RescheduleCount
/// dùng để dựng UID ổn định + SEQUENCE cho việc dời/hủy event trên lịch.
/// </summary>
public record InterviewParticipants(
    InterviewParticipant? Recruiter,
    IReadOnlyList<InterviewParticipant> Interviewers,
    int RoundNumber,
    int RescheduleCount);

/// <summary>
/// Đặt lịch phỏng vấn nội bộ (docs Section 15). Pool slot theo từng schedule (vòng) của hồ sơ;
/// chốt slot bằng khóa lạc quan (OPEN -> BOOKED, ai trước được trước — 15.3).
/// </summary>
public interface ISchedulingRepo : IBaseRepo<long, InterviewSchedule>
{
    /// <summary>Tạo 1 lịch (vòng) + các khung giờ trong 1 transaction. Trả schedule_id.</summary>
    Task<long> InsertScheduleWithSlotsAsync(long companyId, InterviewSchedule schedule, IEnumerable<InterviewSlot> slots);

    /// <summary>Số vòng kế tiếp cho hồ sơ (max round hiện có + 1; 1 nếu chưa có).</summary>
    Task<int> GetNextRoundNumberAsync(long companyId, long applicationId);

    /// <summary>Mọi lịch của hồ sơ kèm slot (Recruiter xem, badge "Vòng x/y").</summary>
    Task<IReadOnlyList<ScheduleWithSlots>> GetByApplicationAsync(long companyId, long applicationId);

    /// <summary>Lịch PENDING mới nhất của hồ sơ (cho ứng viên chọn khung). Null nếu không có.</summary>
    Task<InterviewSchedule?> GetLatestPendingScheduleAsync(long companyId, long applicationId);

    /// <summary>Lịch mới nhất của hồ sơ ở BẤT KỲ trạng thái nào (để hiển thị trạng thái cho ứng viên).</summary>
    Task<InterviewSchedule?> GetLatestScheduleAsync(long companyId, long applicationId);

    /// <summary>Khung của 1 lịch. onlyOpenFuture = chỉ OPEN + giờ tương lai (lọc cho ứng viên — 15.3).</summary>
    Task<IReadOnlyList<InterviewSlot>> GetSlotsAsync(long companyId, long scheduleId, bool onlyOpenFuture);

    /// <summary>Lấy 1 khung theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<InterviewSlot?> GetSlotAsync(long companyId, long slotId);

    /// <summary>Người phỏng vấn đã có khung BOOKED đúng giờ này ở lịch khác chưa (chống trùng giờ — 15.3)?</summary>
    Task<bool> IsInterviewerBookedAtAsync(long companyId, long interviewerId, DateTime startTime, long excludeSlotId);

    /// <summary>
    /// Chốt 1 khung (khóa lạc quan): OPEN->BOOKED nếu còn OPEN, đồng thời khóa các khung còn lại
    /// của lịch (OPEN->LOCKED) + set lịch CONFIRMED + confirmed_slot_id — tất cả trong 1 transaction.
    /// Trả false nếu khung không còn OPEN (người khác vừa đặt / đã khóa).
    /// </summary>
    Task<bool> BookAndConfirmAsync(long companyId, long scheduleId, long slotId);

    /// <summary>Đổi trạng thái lịch (vd NO_SLOT_FITS / CANCELLED).</summary>
    Task SetScheduleStatusAsync(long companyId, long scheduleId, string status);

    /// <summary>
    /// Dời lịch (15.x): thay toàn bộ khung của 1 lịch bằng bộ khung mới + đưa lịch về PENDING +
    /// xóa confirmed_slot_id — trong 1 transaction. Dùng khi Recruiter mở lại khung cho ứng viên chọn.
    /// </summary>
    Task ReplaceSlotsAndReopenAsync(long companyId, long scheduleId, IEnumerable<InterviewSlot> newSlots);

    /// <summary>
    /// Hủy lịch: set lịch CANCELLED + khóa mọi khung chưa khóa (OPEN/BOOKED -> LOCKED) trong 1 transaction.
    /// Giữ confirmed_slot_id để truy vết. Trả false nếu lịch đã CANCELLED từ trước (không làm gì).
    /// </summary>
    Task<bool> CancelScheduleAsync(long companyId, long scheduleId);

    /// <summary>Người này có được gán phỏng vấn buổi đó không (là interviewer của 1 khung bất kỳ)?</summary>
    Task<bool> IsInterviewerOnScheduleAsync(long companyId, long scheduleId, long interviewerId);

    /// <summary>Các buổi được giao cho 1 interviewer (để hiện danh sách buổi cần chấm — 5.7).</summary>
    Task<IReadOnlyList<InterviewSchedule>> GetSchedulesForInterviewerAsync(long companyId, long interviewerId);

    /// <summary>Lấy 1 lịch theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<InterviewSchedule?> GetScheduleByIdAsync(long companyId, long scheduleId);

    /// <summary>
    /// Người trong cuộc của buổi PV đã chốt mới nhất của hồ sơ: recruiter (job.created_by) +
    /// interviewer của khung đã chốt — để gửi kèm lời mời lịch (.ics) cho cả nhóm. Null nếu chưa chốt khung.
    /// </summary>
    Task<InterviewParticipants?> GetConfirmedParticipantsAsync(long companyId, long applicationId);
}
