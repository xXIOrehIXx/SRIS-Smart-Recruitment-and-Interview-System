using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Kết quả chấm 1 tiêu chí trên 1 hồ sơ (docs 5.18): khớp/thiếu + câu bằng chứng trong CV.
/// "AI chỉ ra bằng chứng, con người phán."
/// </summary>
public class ApplicationCriterionMatch : BaseEntity<long>, IHasCompanyInfo
{
    [Key]
    [Column("match_id")]
    public long MatchId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("application_id")]
    public long ApplicationId { get; set; }
    [Column("criteria_id")]
    public long CriteriaId { get; set; }
    [Column("matched")]
    public bool Matched { get; set; }
    /// <summary>Cosine similarity (0-1) với tiêu chí SOFT; NULL với HARD (lọc rule).</summary>
    [Column("similarity")]
    public decimal? Similarity { get; set; }
    /// <summary>Đoạn CV làm bằng chứng (khớp: đoạn giống nhất; thiếu: NULL hoặc đoạn gần nhất).</summary>
    [Column("evidence")]
    public string? Evidence { get; set; }
    [Column("evaluated_at")]
    public DateTime EvaluatedAt { get; set; }
}
