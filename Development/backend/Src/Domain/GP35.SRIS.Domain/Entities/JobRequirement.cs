using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// 1 yêu cầu của Job (V020). Một Job có nhiều Requirement, có thứ tự ordinal để hiển thị.
/// Lưu riêng thay vì NVARCHAR csv trên Job để public site có thể render theo bullet list.
/// </summary>
public class JobRequirement : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("requirement_id")]
    public long RequirementId { get; set; }

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
