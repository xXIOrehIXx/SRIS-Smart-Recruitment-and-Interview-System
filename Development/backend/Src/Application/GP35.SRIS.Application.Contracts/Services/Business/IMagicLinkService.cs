namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>Token magic link vừa phát — token GỐC chỉ trả 1 lần (để nhúng URL gửi email).</summary>
public record MagicLinkIssued(long TokenId, string RawToken, string Purpose, DateTime ExpiresAt);

/// <summary>Kết quả xác thực 1 magic link hợp lệ (chưa đốt).</summary>
public record MagicLinkValidation(long CompanyId, long TokenId, long ApplicationId, string Purpose);

/// <summary>
/// Phát/xác thực magic link của ứng viên (docs 5.13). 4 purpose: QUIZ/SCHEDULE/STATUS/OFFER_RESPONSE.
/// Lưu HASH, one-time = đốt khi CHỐT (gọi <see cref="MarkUsedAsync"/>), TTL theo purpose.
/// </summary>
public interface IMagicLinkService : IBaseService
{
    /// <summary>Phát token mới cho 1 hồ sơ. TTL null = mặc định theo purpose.</summary>
    Task<MagicLinkIssued> IssueAsync(long companyId, long applicationId, string purpose, TimeSpan? ttl = null);

    /// <summary>
    /// Xác thực token gốc cho đúng purpose: tồn tại + chưa hết hạn + chưa đốt. Tăng access_count.
    /// Ném lỗi (401/410/409) nếu không hợp lệ. KHÔNG đốt token (đốt khi ứng viên chốt).
    /// </summary>
    Task<MagicLinkValidation> ValidateAsync(string rawToken, string expectedPurpose);

    /// <summary>Đốt token (ghi used_at) — gọi khi ứng viên CHỐT hành động.</summary>
    Task MarkUsedAsync(long companyId, long tokenId);
}
