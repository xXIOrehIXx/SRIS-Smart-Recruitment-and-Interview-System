using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Khuôn tiêu chí chấm dùng lại ở cấp company (Việc 12). Recruiter tạo 1 lần (vd "Khung phỏng vấn Dev"),
/// rồi clone vào từng job thành <see cref="EvaluationCriteria"/> — đỡ gõ lại, nhất quán giữa các job.
/// </summary>
public class CriteriaTemplate : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("template_id")]
    public long TemplateId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("name")]
    public string Name { get; set; } = null!;
    [Column("description")]
    public string? Description { get; set; }
    [Column("active")]
    public bool Active { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
