using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class InterviewSchedule : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("schedule_id")]
    public long ScheduleId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("application_id")]
    public long ApplicationId { get; set; }
    /// <summary>Pool khung mà ứng viên được mời vào (docs 15). Null với lịch chốt tay không qua pool.</summary>
    [Column("pool_id")]
    public long? PoolId { get; set; }
    [Column("round_number")]
    public int RoundNumber { get; set; }
    [Column("round_name")]
    public string? RoundName { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("confirmed_slot_id")]
    public long? ConfirmedSlotId { get; set; }
    [Column("reschedule_count")]
    public int RescheduleCount { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}