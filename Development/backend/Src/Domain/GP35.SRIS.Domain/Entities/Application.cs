using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class Application : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("application_id")]
    public long ApplicationId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("job_id")]
    public long JobId { get; set; }
    [Column("candidate_id")]
    public long CandidateId { get; set; }
    [Column("cv_id")]
    public long CvId { get; set; }
    [Column("current_state")]
    public string CurrentState { get; set; } = null!;
    [Column("ai_match_score")]
    public decimal? AiMatchScore { get; set; }
    [Column("reject_reason")]
    public string? RejectReason { get; set; }
    [Column("stage_updated_at")]
    public DateTime? StageUpdatedAt { get; set; }
    [Column("rejected_at")]
    public DateTime? RejectedAt { get; set; }
    [Column("hired_at")]
    public DateTime? HiredAt { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}