using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class Job : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("job_id")]
    public long JobId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("title")]
    public string Title { get; set; } = null!;
    [Column("jd_text")]
    public string? JdText { get; set; }
    [Column("embedding")]
    public float[]? Embedding { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}