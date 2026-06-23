using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>1 dòng tiêu chí trong 1 <see cref="CriteriaTemplate"/> (clone sang EvaluationCriteria khi áp vào job).</summary>
public class CriteriaTemplateItem : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("item_id")]
    public long ItemId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("template_id")]
    public long TemplateId { get; set; }
    [Column("name")]
    public string Name { get; set; } = null!;
    [Column("weight")]
    public decimal Weight { get; set; }
    [Column("max_score")]
    public decimal MaxScore { get; set; }
    [Column("display_order")]
    public int DisplayOrder { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
