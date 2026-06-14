using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class EvaluationCriteria : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("criteria_id")]
    public long CriteriaId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("job_id")]
    public long JobId { get; set; }
    [Column("name")]
    public string Name { get; set; } = null!;
    [Column("weight")]
    public decimal Weight { get; set; }
    [Column("max_score")]
    public decimal MaxScore { get; set; }
    [Column("active")]
    public bool Active { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}