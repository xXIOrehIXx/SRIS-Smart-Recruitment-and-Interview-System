using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// 1 câu MCQ đã được Recruiter duyệt, lưu độc lập ở cấp company để tái dùng (ngân hàng câu hỏi — 5.6 / Việc 12).
/// KHÔNG nhập từ ngoài: bank tự bồi từ chính luồng AI gen -> duyệt (mô hình tích luỹ nội bộ).
/// </summary>
public class QuestionBankItem : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("bank_item_id")]
    public long BankItemId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("content")]
    public string Content { get; set; } = null!;
    [Column("options_json")]
    public string OptionsJson { get; set; } = null!;
    [Column("correct_option")]
    public string CorrectOption { get; set; } = null!;
    [Column("topic")]
    public string? Topic { get; set; }
    [Column("difficulty")]
    public string? Difficulty { get; set; }
    /// <summary>Câu gốc trong QuizQuestion mà câu này được ghim từ đó (truy vết nguồn gốc).</summary>
    [Column("source_question_id")]
    public long? SourceQuestionId { get; set; }
    /// <summary>Job mà câu được duyệt từ (để gợi ý tái dùng cho vị trí tương tự).</summary>
    [Column("source_job_id")]
    public long? SourceJobId { get; set; }
    [Column("approved_by")]
    public long? ApprovedBy { get; set; }
    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }
    /// <summary>Số lần câu này được kéo lại vào 1 quiz (đo mức tái dùng).</summary>
    [Column("times_used")]
    public int TimesUsed { get; set; }
    [Column("active")]
    public bool Active { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
