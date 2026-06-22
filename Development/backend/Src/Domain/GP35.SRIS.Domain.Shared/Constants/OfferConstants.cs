namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Trạng thái artifact offer (OfferDetail.status) — docs 5.15. KHÔNG trùng Application.current_state:
/// một cái theo dõi offer, một cái theo dõi pipeline; đồng bộ ACCEPTED ↔ HIRED, DECLINED ↔ REJECTED.
/// </summary>
public static class OfferStatus
{
    /// <summary>Đã gửi, chờ ứng viên phản hồi.</summary>
    public const string Pending = "PENDING";

    /// <summary>Ứng viên đồng ý -> đẩy Application sang HIRED.</summary>
    public const string Accepted = "ACCEPTED";

    /// <summary>Ứng viên từ chối -> đẩy Application sang REJECTED.</summary>
    public const string Declined = "DECLINED";
}
