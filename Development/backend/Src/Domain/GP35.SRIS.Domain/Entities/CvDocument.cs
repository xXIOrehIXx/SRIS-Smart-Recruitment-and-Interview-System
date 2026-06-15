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
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}