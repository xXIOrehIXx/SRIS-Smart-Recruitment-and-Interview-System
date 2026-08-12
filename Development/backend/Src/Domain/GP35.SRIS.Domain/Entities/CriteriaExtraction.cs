using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Trạng thái lượt bóc tiêu chí gần nhất của MỘT job (V037) — hàng đợi cho worker chạy nền.
/// <para>
/// Không phải nhật ký lịch sử: mỗi job đúng một dòng, bấm bóc lại là ghi đè. Kết quả thật
/// (bộ tiêu chí DRAFT) nằm ở <see cref="EvaluationCriteria"/>; bảng này chỉ trả lời được
/// câu "lượt bóc đó xong chưa, hỏng vì gì".
/// </para>
/// </summary>
public class CriteriaExtraction : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("extraction_id")]
    public long ExtractionId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }

    [Column("job_id")]
    public long JobId { get; set; }

    /// <summary>PENDING | RUNNING | DONE | FAILED (hằng số ở <c>ExtractionStatus</c>).</summary>
    [Column("status")]
    public string Status { get; set; } = null!;

    /// <summary>AI_EXTRACT_FAILED | JD_NO_REQUIREMENTS. Chỉ có nghĩa khi Status = FAILED.</summary>
    [Column("error_code")]
    public string? ErrorCode { get; set; }

    /// <summary>Câu hiện cho người dùng khi hỏng (đã viết sẵn theo ngôn ngữ người dùng).</summary>
    [Column("error_message")]
    public string? ErrorMessage { get; set; }

    /// <summary>Số tiêu chí DRAFT bóc được. Chỉ có nghĩa khi Status = DONE.</summary>
    [Column("criteria_count")]
    public int? CriteriaCount { get; set; }

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
