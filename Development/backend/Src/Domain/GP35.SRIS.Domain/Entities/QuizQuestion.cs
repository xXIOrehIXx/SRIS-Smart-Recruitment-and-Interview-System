using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class QuizQuestion : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("question_id")]
    public long QuestionId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("quiz_id")]
    public long QuizId { get; set; }
    [Column("content")]
    public string Content { get; set; } = null!;
    [Column("options_json")]
    public string OptionsJson { get; set; } = null!;
    [Column("correct_option")]
    public string CorrectOption { get; set; } = null!;
    [Column("points")]
    public int Points { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}