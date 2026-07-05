using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// 1 đoạn (chunk) của CV — tầng vector TỪNG-ĐOẠN phục vụ chấm theo tiêu chí (docs 5.18).
/// Tầng cả-CV (CvDocument.embedding — Talent Pool) GIỮ NGUYÊN, hai tầng song song.
/// </summary>
public class CvChunk : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("chunk_id")]
    public long ChunkId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("cv_id")]
    public long CvId { get; set; }
    [Column("chunk_index")]
    public int ChunkIndex { get; set; }
    [Column("content")]
    public string Content { get; set; } = null!;
    /// <summary>VECTOR(1024) — không map EF, xử lý bằng raw SQL (5.11).</summary>
    [Column("embedding")]
    public float[]? Embedding { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}
