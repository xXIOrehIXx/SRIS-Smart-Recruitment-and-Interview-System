using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Token xác thực của User nội bộ (refresh token / reset mật khẩu) — khác magic link ứng viên.
/// Lưu HASH (SHA-256), không lưu gốc. KHÔNG dưới RLS (tra pre-auth theo hash).
/// </summary>
public class UserAuthToken : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("token_id")]
    public long TokenId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("user_id")]
    public long UserId { get; set; }
    [Column("token_hash")]
    public string TokenHash { get; set; } = null!;
    /// <summary>REFRESH | PASSWORD_RESET.</summary>
    [Column("purpose")]
    public string Purpose { get; set; } = null!;
    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }
    [Column("used_at")]
    public DateTime? UsedAt { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}
