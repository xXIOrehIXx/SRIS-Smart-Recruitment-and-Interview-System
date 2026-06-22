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

    /// <summary>Khung còn lại bị khóa sau khi ứng viên đã chốt 1 khung khác.</summary>
    public const string Locked = "LOCKED";
}
