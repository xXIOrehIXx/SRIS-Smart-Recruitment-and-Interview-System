using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class ActivityLog : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("log_id")]
    public long LogId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("application_id")]
    public long ApplicationId { get; set; }
    [Column("user_id")]
    public long? UserId { get; set; }
    [Column("action")]
    public string Action { get; set; } = null!;
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}