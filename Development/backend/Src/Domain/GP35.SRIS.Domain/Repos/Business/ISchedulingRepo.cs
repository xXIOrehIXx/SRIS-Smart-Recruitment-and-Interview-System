using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 pool khung phỏng vấn dùng chung kèm các khung của nó.</summary>
public record PoolWithSlots(InterviewSlotPool Pool, IReadOnlyList<InterviewSlot> Slots);

/// <summary>
/// Đặt lịch phỏng vấn theo POOL DÙNG CHUNG (docs Section 15). Recruiter mở 1 pool (job + vòng) với
/// nhiều khung; mời nhiều ứng viên vào cùng pool; ai chốt trước lấy trước (OPEN -> BOOKED, khóa lạc
/// quan). Các khung khác GIỮ OPEN cho người sau. InterviewSchedule = bản ghi per-ứng-viên (mời/chốt),
/// dùng cho chấm điểm (InterviewScore gắn theo schedule_id).
/// </summary>
public interface ISchedulingRepo : IBaseRepo<long, InterviewSchedule>
{
    // ---------- Pool (bộ khung dùng chung) ----------

    /// <summary>Tạo 1 pool + các khung (status OPEN) trong 1 transaction. Trả pool_id.</summary>
    Task<long> InsertPoolWithSlotsAsync(long companyId, InterviewSlotPool pool, IEnumerable<InterviewSlot> slots);

    /// <summary>Lấy 1 pool theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<InterviewSlotPool?> GetPoolByIdAsync(long companyId, long poolId);

    /// <summary>Mọi pool của 1 job kèm khung (mới nhất trước) — cho Recruiter xem/quản lý.</summary>
    Task<IReadOnlyList<PoolWithSlots>> GetPoolsByJobAsync(long companyId, long jobId);

    /// <summary>Khung của 1 pool. onlyOpenFuture = chỉ OPEN + giờ tương lai (lọc cho ứng viên — 15.3).</summary>
    Task<IReadOnlyList<InterviewSlot>> GetSlotsByPoolAsync(long companyId, long poolId, bool onlyOpenFuture);

    /// <summary>Lấy 1 khung theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<InterviewSlot?> GetSlotAsync(long companyId, long slotId);

    /// <summary>
    /// Hủy pool: pool -> CANCELLED + khóa mọi khung chưa khóa (OPEN/BOOKED -> LOCKED) + các invite còn
    /// PENDING -> CANCELLED, trong 1 transaction. Trả false nếu pool đã CANCELLED từ trước.
    /// </summary>
    Task<bool> CancelPoolAsync(long companyId, long poolId);

    // ---------- Invite / lịch per-ứng-viên ----------

    /// <summary>Tạo 1 invite (InterviewSchedule PENDING gắn pool_id) khi Recruiter mời 1 ứng viên. Trả schedule_id.</summary>
    Task<long> InsertInviteScheduleAsync(long companyId, InterviewSchedule schedule);

    /// <summary>Các invite (schedule) của 1 pool — để liệt kê ứng viên đã mời + trạng thái.</summary>
    Task<IReadOnlyList<InterviewSchedule>> GetSchedulesByPoolAsync(long companyId, long poolId);

    /// <summary>Ứng viên đã có invite (PENDING/CONFIRMED) ở pool này chưa (chống mời trùng)?</summary>
    Task<bool> HasActiveInviteInPoolAsync(long companyId, long poolId, long applicationId);

    /// <summary>Lịch PENDING mới nhất của hồ sơ (cho ứng viên chọn khung). Null nếu không có.</summary>
    Task<InterviewSchedule?> GetLatestPendingScheduleAsync(long companyId, long applicationId);

    /// <summary>Lịch mới nhất của hồ sơ ở BẤT KỲ trạng thái nào (để hiển thị trạng thái cho ứng viên).</summary>
    Task<InterviewSchedule?> GetLatestScheduleAsync(long companyId, long applicationId);

    /// <summary>Lấy 1 lịch theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<InterviewSchedule?> GetScheduleByIdAsync(long companyId, long scheduleId);

    /// <summary>Số lần hồ sơ báo bận (schedule NO_SLOT_FITS) — để suy cờ vàng/đỏ (15).</summary>
    Task<int> CountNoSlotFitsAsync(long companyId, long applicationId);

    /// <summary>Số vòng kế tiếp cho hồ sơ (max round hiện có + 1; 1 nếu chưa có) — dùng khi chốt tay.</summary>
    Task<int> GetNextRoundNumberAsync(long companyId, long applicationId);

    // ---------- Chốt khung ----------

    /// <summary>
    /// Ứng viên chốt 1 khung (khóa lạc quan): OPEN -> BOOKED + gắn booked_application_id NẾU khung còn
    /// OPEN; đồng thời set schedule CONFIRMED + confirmed_slot_id — trong 1 transaction. KHÔNG khóa các
    /// khung khác của pool (giữ OPEN cho người sau). Trả false nếu khung không còn OPEN (người khác vừa đặt).
    /// </summary>
    Task<bool> BookAndConfirmAsync(long companyId, long scheduleId, long slotId, long applicationId);

    /// <summary>Người phỏng vấn đã có khung BOOKED đúng giờ này ở pool khác chưa (chống trùng giờ — 15.3)?</summary>
    Task<bool> IsInterviewerBookedAtAsync(long companyId, long interviewerId, DateTime startTime, long excludeSlotId);

    /// <summary>Đổi trạng thái lịch (vd NO_SLOT_FITS).</summary>
    Task SetScheduleStatusAsync(long companyId, long scheduleId, string status);

    /// <summary>
    /// Recruiter chốt lịch TAY (nhánh gọi điện): tạo pool 1 khung (CLOSED, slot BOOKED) + schedule
    /// CONFIRMED cho ứng viên, trong 1 transaction. Trả schedule_id (để chấm điểm).
    /// </summary>
    Task<long> ManualConfirmAsync(
        long companyId, long jobId, long applicationId, long interviewerId,
        DateTime startTime, int roundNumber, long? createdBy);

    // ---------- Chấm điểm (5.7) ----------

    /// <summary>Người này có được giao chấm buổi đó không (là interviewer của KHUNG ĐÃ CHỐT của lịch)?</summary>
    Task<bool> IsInterviewerOnScheduleAsync(long companyId, long scheduleId, long interviewerId);

    /// <summary>Các buổi ĐÃ CHỐT giao cho 1 interviewer (interviewer của confirmed slot) — để hiện danh sách cần chấm.</summary>
    Task<IReadOnlyList<InterviewerScheduleRow>> GetSchedulesForInterviewerAsync(long companyId, long interviewerId);
}

/// <summary>1 buổi của interviewer kèm thông tin hiển thị (ứng viên + job + giờ hẹn).</summary>
public record InterviewerScheduleRow(
    long ScheduleId, long ApplicationId, int RoundNumber, string Status,
    DateTime StartTime, string CandidateName, string CandidateEmail, string JobTitle);
