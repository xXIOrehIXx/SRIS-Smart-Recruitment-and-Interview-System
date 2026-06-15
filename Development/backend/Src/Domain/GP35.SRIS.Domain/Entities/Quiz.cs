using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class Quiz : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("quiz_id")]
    public long QuizId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("job_id")]
    public long JobId { get; set; }
    [Column("title")]
    public string? Title { get; set; }
    [Column("type")]
    public string Type { get; set; } = null!;
    [Column("stage")]
    public string? Stage { get; set; }
    [Column("duration_min")]
    public int? DurationMin { get; set; }
    [Column("total_questions")]
    public int? TotalQuestions { get; set; }
    [Column("pass_score")]
    public decimal? PassScore { get; set; }
    [Column("shuffle_questions")]
    public bool ShuffleQuestions { get; set; }
    [Column("tab_switch_limit")]
    public int? TabSwitchLimit { get; set; }
    [Column("generated_by_ai")]
    public bool GeneratedByAi { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}