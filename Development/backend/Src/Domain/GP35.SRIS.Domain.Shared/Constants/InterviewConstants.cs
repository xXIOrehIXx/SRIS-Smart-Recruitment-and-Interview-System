namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>Trạng thái 1 lịch phỏng vấn / 1 vòng (InterviewSchedule.status) — docs 15.4.</summary>
public static class InterviewScheduleStatus
{
    /// <summary>Đã mở khung, chờ ứng viên chọn.</summary>
    public const string Pending = "PENDING";

    /// <summary>Ứng viên đã chốt 1 khung.</summary>
    public const string Confirmed = "CONFIRMED";

    /// <summary>Ứng viên báo không khung nào phù hợp -> Recruiter mở vòng mới.</summary>
    public const string NoSlotFits = "NO_SLOT_FITS";

    /// <summary>Recruiter hủy lịch.</summary>
    public const string Cancelled = "CANCELLED";
}

/// <summary>
/// Trạng thái 1 phiếu chấm (InterviewScore.status) — Blind Review (docs 5.7).
/// DRAFT = nháp riêng tư, ẩn với người khác; SUBMITTED = đã nộp -> mới mở blind (lộ điểm/note).
/// </summary>
public static class InterviewScoreStatus
{
    public const string Draft = "DRAFT";
    public const string Submitted = "SUBMITTED";
}

/// <summary>Trạng thái 1 khung giờ (InterviewSlot.status) — docs 15.3.</summary>
public static class InterviewSlotStatus
{
    /// <summary>Còn trống, ứng viên chọn được.</summary>
    public const string Open = "OPEN";

    /// <summary>Ứng viên đã đặt khung này.</summary>
    public const string Booked = "BOOKED";

    /// <summary>Khung bị khóa khi pool bị hủy (không còn dùng được).</summary>
    public const string Locked = "LOCKED";
}

/// <summary>Trạng thái 1 pool khung phỏng vấn dùng chung (InterviewSlotPool.status) — docs 15.</summary>
public static class InterviewPoolStatus
{
    /// <summary>Đang mở, còn nhận ứng viên chọn khung.</summary>
    public const string Open = "OPEN";

    /// <summary>Đã đóng (hết khung / recruiter đóng thủ công / dùng cho lịch chốt tay).</summary>
    public const string Closed = "CLOSED";

    /// <summary>Recruiter hủy pool.</summary>
    public const string Cancelled = "CANCELLED";
}

/// <summary>
/// Cờ nhắc recruiter khi ứng viên báo bận nhiều lần (docs 15). Đếm số schedule NO_SLOT_FITS:
/// 0 = không cờ, 1 = vàng (tự quyết mở vòng mới / gọi điện), >= <see cref="RedThreshold"/> = đỏ (nên gọi điện chốt tay).
/// Không auto-reject — chỉ để recruiter NHÌN THẤY.
/// </summary>
public static class SchedulingFlag
{
    public const string None = "NONE";
    public const string Yellow = "YELLOW";
    public const string Red = "RED";

    /// <summary>Số lần báo bận để chuyển sang cờ đỏ.</summary>
    public const int RedThreshold = 2;

    /// <summary>Suy cờ từ số lần báo bận.</summary>
    public static string From(int noSlotFitsCount) =>
        noSlotFitsCount <= 0 ? None : noSlotFitsCount >= RedThreshold ? Red : Yellow;
}
