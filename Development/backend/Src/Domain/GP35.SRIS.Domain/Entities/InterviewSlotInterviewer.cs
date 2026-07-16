using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Thành viên panel phỏng vấn của 1 khung (docs 15 — mở rộng A). 1 khung có 1..N interviewer.
/// </summary>
public class InterviewSlotInterviewer : IHasCompanyInfo
{
    [Column("slot_id")]
    public long SlotId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }

    [Column("interviewer_id")]
    public long InterviewerId { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}
