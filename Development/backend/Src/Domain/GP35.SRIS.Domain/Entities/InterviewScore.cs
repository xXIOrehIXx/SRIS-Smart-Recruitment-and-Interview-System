using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class InterviewScore : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("score_id")]
    public long ScoreId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("schedule_id")]
    public long ScheduleId { get; set; }
    [Column("interviewer_id")]
    public long InterviewerId { get; set; }
    [Column("criteria_id")]
    public long CriteriaId { get; set; }
    [Column("score")]
    public decimal? Score { get; set; }
    [Column("note")]
    public string? Note { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("submitted_at")]
    public DateTime? SubmittedAt { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}