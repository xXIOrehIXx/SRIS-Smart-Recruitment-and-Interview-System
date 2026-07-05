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

    // ---- Chấm CV theo tiêu chí (docs 5.18 — migration V013) ----

    /// <summary>HARD (lọc rule/keyword) hay SOFT (so vector).</summary>
    [Column("criteria_type")]
    public string CriteriaType { get; set; } = "SOFT";
    /// <summary>true = thấy được trong CV; false = chỉ đánh giá khi phỏng vấn (chấm CV bỏ qua).</summary>
    [Column("cv_matchable")]
    public bool CvMatchable { get; set; } = true;
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
    /// <summary>Từ khóa nhận diện cho tiêu chí HARD, phân tách ';'. NULL -> dùng Name.</summary>
    [Column("keywords")]
    public string? Keywords { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}