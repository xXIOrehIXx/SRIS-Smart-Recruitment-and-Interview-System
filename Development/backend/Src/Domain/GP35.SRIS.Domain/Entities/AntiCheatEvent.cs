using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class AntiCheatEvent : BaseEntity<long>, IHasCompanyInfo
{
    [Key]
    [Column("event_id")]
    public long EventId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("attempt_id")]
    public long AttemptId { get; set; }
    [Column("event_type")]
    public string EventType { get; set; } = null!;
    [Column("occurred_at")]
    public DateTime OccurredAt { get; set; }
}