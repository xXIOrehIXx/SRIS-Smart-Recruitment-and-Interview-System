using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class CvDocument : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("cv_id")]
    public long CvId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("candidate_id")]
    public long CandidateId { get; set; }
    [Column("file_url")]
    public string? FileUrl { get; set; }
    [Column("file_name")]
    public string? FileName { get; set; }
    [Column("file_size")]
    public int? FileSize { get; set; }
    [Column("mime_type")]
    public string? MimeType { get; set; }
    [Column("extracted_text")]
    public string? ExtractedText { get; set; }
    [Column("embedding")]
    public float[]? Embedding { get; set; }
    [Column("parse_status")]
    public string ParseStatus { get; set; } = null!;

    /// <summary>
    /// Tóm tắt CV do AI sinh, mỗi gạch đầu dòng một dòng (V033). Chỉ mô tả nội dung CV —
    /// không có điểm, không so với JD (hệ thống không chấm CV).
    /// </summary>
    [Column("summary")]
    public string? Summary { get; set; }

    /// <summary>Thời điểm sinh tóm tắt. Null = chưa tóm tắt lần nào.</summary>
    [Column("summary_at")]
    public DateTime? SummaryAt { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}