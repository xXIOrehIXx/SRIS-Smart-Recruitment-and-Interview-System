using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class EmailTemplate : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("template_id")]
    public long TemplateId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("type")]
    public string Type { get; set; } = null!;
    [Column("name")]
    public string? Name { get; set; }
    [Column("subject")]
    public string Subject { get; set; } = null!;
    [Column("body")]
    public string Body { get; set; } = null!;
    [Column("is_active")]
    public bool IsActive { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}