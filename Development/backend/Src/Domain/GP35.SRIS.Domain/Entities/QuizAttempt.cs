using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class QuizAttempt : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("attempt_id")]
    public long AttemptId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("application_id")]
    public long ApplicationId { get; set; }
    [Column("quiz_id")]
    public long QuizId { get; set; }
    [Column("started_at")]
    public DateTime? StartedAt { get; set; }
    [Column("submitted_at")]
    public DateTime? SubmittedAt { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("duration_seconds")]
    public int? DurationSeconds { get; set; }
    [Column("monitor_count")]
    public int? MonitorCount { get; set; }
    [Column("ip_address")]
    public string? IpAddress { get; set; }
    [Column("score")]
    public decimal? Score { get; set; }
    [Column("risk_score")]
    public int RiskScore { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}