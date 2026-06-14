using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class EmailLog : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("email_id")]
    public long EmailId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("application_id")]
    public long ApplicationId { get; set; }
    [Column("template_id")]
    public long? TemplateId { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("sent_at")]
    public DateTime? SentAt { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}