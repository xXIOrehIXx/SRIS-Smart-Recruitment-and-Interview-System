using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// File đính kèm của một thư mời nhận việc — chủ yếu là BẢN SCAN hợp đồng đã ký hai bên (V058).
/// Nhiều dòng / một offer: giấy ký tay đi qua nhiều lượt, và người ta giữ đúng chỗ này để sau
/// này tra "đã ký chưa, ký lúc nào".
/// </summary>
public class OfferAttachment : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("attachment_id")]
    public long AttachmentId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("offer_id")]
    public long OfferId { get; set; }
    [Column("application_id")]
    public long ApplicationId { get; set; }

    /// <summary>Object key trên MinIO, KHÔNG phải URL tải (presigned hết hạn ~1 giờ).</summary>
    [Column("file_url")]
    public string FileUrl { get; set; } = null!;
    [Column("file_name")]
    public string FileName { get; set; } = null!;
    [Column("file_size")]
    public int? FileSize { get; set; }
    [Column("mime_type")]
    public string? MimeType { get; set; }

    /// <summary>SIGNED_CONTRACT (mặc định) | OTHER — xem <c>OfferAttachmentKind</c>.</summary>
    [Column("kind")]
    public string Kind { get; set; } = null!;
    [Column("note")]
    public string? Note { get; set; }

    [Column("uploaded_by")]
    public long? UploadedBy { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
