using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Lượt AI tổng hợp ý kiến hội đồng phỏng vấn của MỘT hồ sơ (V047) — vừa là hàng đợi cho
/// worker, vừa là chỗ lưu kết quả. Cùng hình dạng <see cref="CvScreening"/>: mỗi hồ sơ đúng
/// một dòng, bấm tổng hợp lại là ghi đè.
/// <para>
/// KHÔNG có cột nào mang nghĩa "nên tuyển": AI chỉ đọc hộ các phiếu chấm rồi chỉ ra hội đồng
/// đồng ý ở đâu và lệch nhau ở đâu. Quyền quyết tuyển vẫn của Giám đốc (V043).
/// </para>
/// </summary>
public class PanelSummary : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("summary_id")]
    public long SummaryId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }

    [Column("application_id")]
    public long ApplicationId { get; set; }

    /// <summary>PENDING | RUNNING | DONE | FAILED (hằng số ở <c>PanelSummaryStatus</c>).</summary>
    [Column("status")]
    public string Status { get; set; } = null!;

    /// <summary>AI_SUMMARY_FAILED | NO_VERDICTS. Chỉ có nghĩa khi Status = FAILED.</summary>
    [Column("error_code")]
    public string? ErrorCode { get; set; }

    [Column("error_message")]
    public string? ErrorMessage { get; set; }

    /// <summary>3-5 câu tổng hợp cả hội đồng. Chỉ có nghĩa khi Status = DONE.</summary>
    [Column("consensus")]
    public string? Consensus { get; set; }

    /// <summary>JSON <c>["..."]</c> — nhận định từ 2 người phỏng vấn trở lên cùng nêu.</summary>
    [Column("agreements_json")]
    public string? AgreementsJson { get; set; }

    /// <summary>JSON <c>["..."]</c> — chỗ các phiếu nói ngược nhau.</summary>
    [Column("disagreements_json")]
    public string? DisagreementsJson { get; set; }

    /// <summary>JSON <c>["..."]</c> — điều nên hỏi thêm trước khi chốt.</summary>
    [Column("open_questions_json")]
    public string? OpenQuestionsJson { get; set; }

    /// <summary>
    /// Số phiếu AI đã đọc lúc sinh bản tóm tắt. So với số phiếu hiện tại để biết bản tóm tắt
    /// đã cũ (có người nộp phiếu sau đó) — người quyết cần biết mình đang đọc thiếu.
    /// </summary>
    [Column("source_verdict_count")]
    public int? SourceVerdictCount { get; set; }

    [Column("requested_by")]
    public long? RequestedBy { get; set; }

    [Column("requested_at")]
    public DateTime? RequestedAt { get; set; }

    [Column("started_at")]
    public DateTime? StartedAt { get; set; }

    [Column("finished_at")]
    public DateTime? FinishedAt { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
