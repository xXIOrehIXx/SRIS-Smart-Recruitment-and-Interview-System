namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Trạng thái artifact offer (OfferDetail.status) — docs 5.15. KHÔNG trùng Application.current_state:
/// một cái theo dõi thư mời, một cái theo dõi pipeline; đồng bộ ACCEPTED ↔ HIRED, DECLINED ↔ REJECTED.
///
/// Từ V029, ứng viên KHÔNG tự bấm đồng ý/từ chối nữa: họ nhận thư mời (PDF) qua email và trả lời
/// ngoài hệ thống, Human Resource/DM ghi nhận kết quả trong Portal. Giá trị giữ nguyên 3 như cũ
/// (CHECK constraint không đổi, KPI offer acceptance rate chạy nguyên) — chỉ đổi cách đọc.
/// </summary>
public static class OfferStatus
{
    /// <summary>Đã gửi thư mời, chờ ứng viên trả lời (ngoài hệ thống).</summary>
    public const string Pending = "PENDING";

    /// <summary>Human Resource/DM ghi nhận ứng viên nhận việc -> đẩy Application sang HIRED.</summary>
    public const string Accepted = "ACCEPTED";

    /// <summary>Human Resource/DM ghi nhận ứng viên từ chối -> đẩy Application sang REJECTED.</summary>
    public const string Declined = "DECLINED";
}

/// <summary>
/// Loại file đính kèm thư mời (OfferAttachment.kind — V058). Khớp CK_OfferAttachment_kind.
/// </summary>
public static class OfferAttachmentKind
{
    /// <summary>Bản scan thư mời/hợp đồng đã có chữ ký của ứng viên và đại diện công ty.</summary>
    public const string SignedContract = "SIGNED_CONTRACT";

    /// <summary>Giấy tờ khác đi kèm (phụ lục, biên bản bàn giao...).</summary>
    public const string Other = "OTHER";
}
