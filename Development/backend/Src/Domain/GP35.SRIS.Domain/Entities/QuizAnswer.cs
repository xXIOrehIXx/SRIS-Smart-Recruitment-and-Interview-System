using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class QuizAnswer : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("answer_id")]
    public long AnswerId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("attempt_id")]
    public long AttemptId { get; set; }
    [Column("question_id")]
    public long QuestionId { get; set; }
    [Column("selected_option")]
    public string? SelectedOption { get; set; }
    [Column("is_correct")]
    public bool? IsCorrect { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}