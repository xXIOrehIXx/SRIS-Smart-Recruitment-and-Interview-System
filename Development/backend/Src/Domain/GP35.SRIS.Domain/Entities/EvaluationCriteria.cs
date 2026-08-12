using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class EvaluationCriteria : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("criteria_id")]
    public long CriteriaId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("job_id")]
    public long JobId { get; set; }
    [Column("name")]
    public string Name { get; set; } = null!;
    [Column("description")]
    public string? Description { get; set; }
    [Column("weight")]
    public decimal Weight { get; set; }
    [Column("max_score")]
    public decimal MaxScore { get; set; }
    [Column("display_order")]
    public int DisplayOrder { get; set; }
    [Column("active")]
    public bool Active { get; set; }

    // ---- Vòng đời tiêu chí: AI bóc DRAFT -> người duyệt chốt APPROVED (docs 5.18) ----
    //
    // V038 đã bỏ criteria_type / cv_matchable / keywords: cả ba là mô hình dữ liệu của tính
    // năng máy chấm CV, cắt khỏi scope 08/08/2026. Đừng thêm lại khi chưa mở lại scope đó.

    /// <summary>MANUAL (người gõ) hay AI_EXTRACTED (AI bóc từ JD).</summary>
    [Column("source")]
    public string Source { get; set; } = "MANUAL";
    /// <summary>DRAFT (AI bóc, chờ duyệt) hay APPROVED (đã chốt — mới được dùng để chấm).</summary>
    [Column("status")]
    public string Status { get; set; } = "APPROVED";
    [Column("approved_by")]
    public long? ApprovedBy { get; set; }
    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}