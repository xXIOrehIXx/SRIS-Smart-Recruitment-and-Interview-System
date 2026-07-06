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
    [Column("pool_id")]
    public long PoolId { get; set; }
    /// <summary>Ứng viên (application) đã đặt khung này. Null khi khung còn OPEN.</summary>
    [Column("booked_application_id")]
    public long? BookedApplicationId { get; set; }
    [Column("interviewer_id")]
    public long InterviewerId { get; set; }
    [Column("start_time")]
    public DateTime StartTime { get; set; }
    [Column("end_time")]
    public DateTime? EndTime { get; set; }
    [Column("location")]
    public string? Location { get; set; }
    [Column("meeting_link")]
    public string? MeetingLink { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}