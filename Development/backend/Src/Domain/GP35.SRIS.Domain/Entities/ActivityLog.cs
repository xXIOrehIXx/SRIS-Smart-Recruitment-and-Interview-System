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
    [Column("from_state")]
    public string? FromState { get; set; }
    [Column("to_state")]
    public string? ToState { get; set; }
    [Column("detail")]
    public string? Detail { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}