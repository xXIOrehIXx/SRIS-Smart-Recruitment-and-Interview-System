using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class InterviewSlot : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("slot_id")]
    public long SlotId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("schedule_id")]
    public long ScheduleId { get; set; }
    [Column("interviewer_id")]
    public long InterviewerId { get; set; }
    [Column("start_time")]
    public DateTime StartTime { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}