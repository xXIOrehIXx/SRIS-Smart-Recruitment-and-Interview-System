using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// Magic link của ứng viên (docs 5.13). Lưu HASH token (SHA-256), không lưu gốc.
/// One-time = đốt khi CHỐT (used_at) chứ không phải khi mở; trong TTL mở lại bao nhiêu lần cũng được.
/// </summary>
public interface IMagicLinkTokenRepo : IBaseRepo<long, MagicLinkToken>
{
    /// <summary>Tạo token, trả về token_id vừa sinh.</summary>
    Task<long> InsertAsync(long companyId, MagicLinkToken token);

    /// <summary>Tra token theo hash (đã lọc theo tenant). Null nếu không có trong company.</summary>
    Task<MagicLinkToken?> GetByHashAsync(long companyId, string tokenHash);

    /// <summary>Đốt token: ghi used_at (chỉ gọi khi ứng viên CHỐT — nộp bài/xác nhận).</summary>
    Task MarkUsedAsync(long companyId, long tokenId);

    /// <summary>Tăng bộ đếm số lần truy cập (mỗi lần mở link).</summary>
    Task IncrementAccessAsync(long companyId, long tokenId);
}
