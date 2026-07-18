using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// 1 quyền lợi của Job (V020). Một Job có nhiều Benefit, có thứ tự ordinal.
/// </summary>
public class JobBenefit : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("benefit_id")]
    public long BenefitId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("job_id")]
    public long JobId { get; set; }
    [Column("ordinal")]
    public int Ordinal { get; set; }
    [Column("content")]
    public string Content { get; set; } = null!;
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}
