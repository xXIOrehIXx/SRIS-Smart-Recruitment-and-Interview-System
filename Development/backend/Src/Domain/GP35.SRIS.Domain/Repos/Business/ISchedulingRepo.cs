using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 pool khung phỏng vấn dùng chung kèm các khung của nó.</summary>
public record PoolWithSlots(InterviewSlotPool Pool, IReadOnlyList<InterviewSlot> Slots);

/// <summary>1 interviewer đang bận kèm giờ buổi đã chốt — để báo lỗi có ngữ cảnh.</summary>
public record BusyInterviewer(long InterviewerId, DateTime StartTime);

/// <summary>
/// 1 buổi đã chốt của 1 interviewer trong khoảng đang xem (V047) — nhân sự nhìn trước khi
/// nhấc máy hẹn giờ, thay vì chỉ bị báo trùng SAU khi đã hẹn xong với ứng viên.
/// </summary>
public record InterviewerBusySlot(
    long InterviewerId, DateTime StartTime, DateTime? EndTime, string? CandidateName);

/// <summary>
/// 1 buổi phỏng vấn của một vị trí, đủ để hiện thẳng lên bảng của bộ phận nhân sự
/// (ứng viên + giờ + vòng + trạng thái). Panel lấy riêng theo slot_id.
/// </summary>
public record JobScheduleRow(
    long ScheduleId, long ApplicationId, long SlotId, int RoundNumber, string? RoundName,
    string Status, DateTime StartTime, string CandidateName, string CandidateEmail,
    string ApplicationState);

/// <summary>
/// Đặt lịch phỏng vấn (docs Section 15 — viết lại 15/08/2026). Bộ phận nhân sự gọi điện thống nhất
/// giờ với ứng viên và người phỏng vấn rồi NHẬP buổi đã chốt vào hệ thống: mỗi buổi = 1 pool 1 khung
/// (CLOSED/BOOKED) + 1 InterviewSchedule CONFIRMED. Không còn pool khung mở cho ứng viên tự chọn.
/// Pool/slot giữ lại làm nơi lưu giờ + panel của buổi; InterviewScore gắn theo schedule_id.
/// </summary>
public interface ISchedulingRepo : IBaseRepo<long, InterviewSchedule>
{
    // ---------- Buổi phỏng vấn (pool 1 khung) ----------

    /// <summary>Lấy 1 pool theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<InterviewSlotPool?> GetPoolByIdAsync(long companyId, long poolId);

    /// <summary>Mọi pool của 1 job kèm khung (mới nhất trước) — đánh số vòng khi đặt lịch.</summary>
    Task<IReadOnlyList<PoolWithSlots>> GetPoolsByJobAsync(long companyId, long jobId);

    /// <summary>Mọi buổi phỏng vấn của 1 vị trí kèm tên ứng viên + giờ (bảng của nhân sự).</summary>
    Task<IReadOnlyList<JobScheduleRow>> GetSchedulesByJobAsync(long companyId, long jobId);

    /// <summary>Panel (interviewer) của các khung — trả map slot_id -> danh sách interviewer_id.</summary>
    Task<IReadOnlyDictionary<long, List<long>>> GetPanelsBySlotIdsAsync(long companyId, IReadOnlyList<long> slotIds);

    /// <summary>Lấy 1 khung theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<InterviewSlot?> GetSlotAsync(long companyId, long slotId);

    /// <summary>
    /// Hủy buổi: pool -> CANCELLED + khóa khung (OPEN/BOOKED -> LOCKED) + lịch của pool -> CANCELLED,
    /// trong 1 transaction. Trả false nếu pool đã CANCELLED từ trước.
    /// </summary>
    Task<bool> CancelPoolAsync(long companyId, long poolId);

    // ---------- Lịch per-ứng-viên ----------

    /// <summary>
    /// Ứng viên đã CHỐT lịch cho vòng này chưa — chặn đặt 2 buổi cùng một vòng cho một người.
    /// </summary>
    Task<bool> HasConfirmedScheduleForRoundAsync(long companyId, long applicationId, int roundNumber);

    /// <summary>
    /// Mọi buổi phỏng vấn của 1 hồ sơ, vòng nhỏ trước (multi-round = dữ liệu trong state INTERVIEW).
    /// DM dùng để xem điểm từng vòng trước khi quyết tuyển.
    /// </summary>
    Task<IReadOnlyList<InterviewSchedule>> GetSchedulesByApplicationAsync(long companyId, long applicationId);

    /// <summary>Lấy 1 lịch theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<InterviewSchedule?> GetScheduleByIdAsync(long companyId, long scheduleId);

    /// <summary>
    /// Số vòng kế tiếp cho hồ sơ (max round hiện có + 1; 1 nếu chưa có).
    /// Lịch đã HỦY không tính — buổi không diễn ra thì không chiếm số vòng.
    /// </summary>
    Task<int> GetNextRoundNumberAsync(long companyId, long applicationId);

    // ---------- Người phỏng vấn DM chỉ định cho hồ sơ (V045) ----------

    /// <summary>
    /// Danh sách interviewer Trưởng bộ phận đã chỉ định cho hồ sơ (rỗng = chưa chỉ định).
    /// Đây là tập NGƯỜI ĐƯỢC PHÉP gặp ứng viên; nhân sự đặt buổi chỉ chọn trong đây.
    /// </summary>
    Task<IReadOnlyList<long>> GetAssignedInterviewersAsync(long companyId, long applicationId);

    /// <summary>
    /// Ghi đè danh sách chỉ định của hồ sơ (xóa hết rồi thêm mới, trong 1 transaction) — DM
    /// chỉ định lần đầu hoặc đổi người cho vòng sau. Buổi ĐÃ đặt không bị đụng: panel của buổi
    /// nằm ở InterviewSlotInterviewer, đổi danh sách không rút người khỏi buổi đã hẹn.
    /// </summary>
    Task ReplaceAssignedInterviewersAsync(
        long companyId, long applicationId, IReadOnlyList<long> interviewerIds, long? assignedBy);

    // ---------- Chống trùng giờ ----------

    /// <summary>
    /// Check CẢ PANEL cùng lúc — trả về interviewer đầu tiên trong panel đã có khung BOOKED nằm
    /// trong cửa sổ ±<paramref name="minGap"/> quanh <paramref name="startTime"/>, kèm giờ buổi đó.
    /// Trả null nếu cả panel rảnh. Cách nhau ĐÚNG minGap là hợp lệ (biên mở).
    /// </summary>
    Task<BusyInterviewer?> FindBusyInterviewerAsync(
        long companyId, IReadOnlyList<long> interviewerIds, DateTime startTime,
        TimeSpan minGap, long excludeSlotId);

    /// <summary>
    /// Mọi buổi đã CHỐT (slot BOOKED) của một nhóm interviewer trong khoảng [from, to) — lịch bận
    /// để hiện lên form đặt lịch. Khác <see cref="FindBusyInterviewerAsync"/>: cái kia trả 1 va
    /// chạm để CHẶN, cái này trả cả khoảng để NHÌN.
    /// </summary>
    Task<IReadOnlyList<InterviewerBusySlot>> GetInterviewerBusySlotsAsync(
        long companyId, IReadOnlyList<long> interviewerIds, DateTime fromUtc, DateTime toUtc);

    /// <summary>
    /// Giờ buổi đã CHỐT của CHÍNH ứng viên nằm trong cửa sổ ±<paramref name="minGap"/> quanh
    /// <paramref name="startTime"/> (bỏ qua <paramref name="excludeScheduleId"/>) — chặn 1 ứng viên
    /// ngồi 2 buổi cùng lúc / sát nhau. Null nếu ứng viên rảnh.
    /// </summary>
    Task<DateTime?> FindCandidateBusyAtAsync(
        long companyId, long applicationId, DateTime startTime,
        TimeSpan minGap, long excludeScheduleId);

    /// <summary>
    /// Đặt 1 buổi phỏng vấn đã thống nhất qua điện thoại: tạo pool 1 khung (CLOSED, slot BOOKED)
    /// + schedule CONFIRMED cho ứng viên, trong 1 transaction. Trả schedule_id (để chấm điểm).
    /// </summary>
    Task<long> ManualConfirmAsync(
        long companyId, long jobId, long applicationId, IReadOnlyList<long> interviewerIds,
        DateTime startTime, int roundNumber, string? roundName, long? createdBy);

    // ---------- Chấm điểm (5.7) ----------

    /// <summary>Người này có được giao chấm buổi đó không (là interviewer của KHUNG ĐÃ CHỐT của lịch)?</summary>
    Task<bool> IsInterviewerOnScheduleAsync(long companyId, long scheduleId, long interviewerId);

    /// <summary>Các buổi ĐÃ CHỐT giao cho 1 interviewer (interviewer của confirmed slot) — để hiện danh sách cần chấm.</summary>
    Task<IReadOnlyList<InterviewerScheduleRow>> GetSchedulesForInterviewerAsync(long companyId, long interviewerId);

    /// <summary>Số interviewer trong panel của buổi (để hiển thị "số người tham gia" ở header phiếu chấm).</summary>
    Task<int> GetPanelSizeAsync(long companyId, long scheduleId);

    /// <summary>Giờ bắt đầu thực sự của buổi (từ slot đã chốt). Trả default nếu chưa chốt.</summary>
    Task<DateTime> GetConfirmedSlotStartAsync(long companyId, long scheduleId);
}

/// <summary>1 buổi của interviewer kèm thông tin hiển thị (ứng viên + job + giờ hẹn).</summary>
public record InterviewerScheduleRow(
    long ScheduleId, long ApplicationId, int RoundNumber, string Status,
    DateTime StartTime, string CandidateName, string CandidateEmail, string JobTitle,
    string MySheetStatus, string ApplicationState, string? RoundName);
