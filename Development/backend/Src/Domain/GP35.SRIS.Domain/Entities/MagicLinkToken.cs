using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class MagicLinkToken : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("token_id")]
    public long TokenId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("application_id")]
    public long ApplicationId { get; set; }
    [Column("token_hash")]
    public string TokenHash { get; set; } = null!;
    [Column("purpose")]
    public string Purpose { get; set; } = null!;
    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }
    [Column("used_at")]
    public DateTime? UsedAt { get; set; }
    [Column("access_count")]
    public int AccessCount { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}