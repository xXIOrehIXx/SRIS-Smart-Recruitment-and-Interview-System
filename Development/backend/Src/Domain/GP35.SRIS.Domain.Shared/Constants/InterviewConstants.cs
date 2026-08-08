namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>Trạng thái 1 lịch phỏng vấn / 1 vòng (InterviewSchedule.status) — docs 15.4.</summary>
public static class InterviewScheduleStatus
{
    /// <summary>Đã mở khung, chờ ứng viên chọn.</summary>
    public const string Pending = "PENDING";

    /// <summary>Ứng viên đã chốt 1 khung.</summary>
    public const string Confirmed = "CONFIRMED";

    /// <summary>Ứng viên báo không khung nào phù hợp -> Human Resource mở vòng mới.</summary>
    public const string NoSlotFits = "NO_SLOT_FITS";

    /// <summary>Human Resource hủy lịch.</summary>
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

/// <summary>
/// Kết luận của người phỏng vấn (InterviewFeedback.recommendation — V031). Đây là thứ
/// người quyết tuyển đọc trước tiên: "nên tuyển hay không", điểm chỉ là phần bổ trợ.
/// </summary>
public static class InterviewRecommendation
{
    public const string Hire = "HIRE";
    public const string NoHire = "NO_HIRE";
    public const string Unsure = "UNSURE";

    public static bool IsValid(string? value) =>
        value is Hire or NoHire or Unsure;
}

/// <summary>
/// Ràng buộc thời gian giữa các buổi phỏng vấn. Hệ thống chỉ lưu giờ BẮT ĐẦU (không có
/// thời lượng), nên "không trùng" được hiểu là hai buổi phải cách nhau tối thiểu
/// <see cref="MinGapHours"/> tiếng — áp cho CẢ ứng viên (không thể ngồi 2 buổi một lúc)
/// lẫn interviewer (không thể chấm 2 buổi một lúc).
/// </summary>
public static class InterviewTiming
{
    /// <summary>Khoảng cách tối thiểu giữa 2 buổi phỏng vấn (giờ).</summary>
    public const int MinGapHours = 1;

    /// <summary>Cùng giá trị dạng TimeSpan — dùng làm cửa sổ chống trùng khi chốt khung.</summary>
    public static TimeSpan MinGap => TimeSpan.FromHours(MinGapHours);
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

    /// <summary>Human Resource hủy pool.</summary>
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
