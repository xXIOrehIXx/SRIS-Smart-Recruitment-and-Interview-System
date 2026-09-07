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
    /// <summary>
    /// Vị trí sở hữu bộ tiêu chí. NULL khi bộ tiêu chí còn nằm ở Yêu cầu tuyển dụng —
    /// job chưa tồn tại (V056). Được điền lúc nhân sự tạo tin từ yêu cầu đã duyệt.
    /// </summary>
    [Column("job_id")]
    public long? JobId { get; set; }

    /// <summary>
    /// Yêu cầu tuyển dụng đã sinh ra bộ tiêu chí này (V056). GIỮ NGUYÊN sau khi job được tạo
    /// — nó là dấu vết nguồn, trả lời "bộ tiêu chí của vị trí này ra đời từ đề bài nào".
    /// NULL với tiêu chí tạo trực tiếp trên job (đường cũ, và mọi dòng có trước V056).
    /// </summary>
    [Column("request_id")]
    public long? RequestId { get; set; }
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
    /// <summary>
    /// DRAFT (đang soạn) | PENDING (đã gửi, chờ Trưởng bộ phận duyệt) | APPROVED (đã chốt —
    /// mới được dùng để chấm). Cửa PENDING thêm ở V055.
    /// </summary>
    [Column("status")]
    public string Status { get; set; } = "APPROVED";
    [Column("approved_by")]
    public long? ApprovedBy { get; set; }
    [Column("approved_at")]
    public DateTime? ApprovedAt { get; set; }

    // ---- V055: cửa duyệt của Trưởng bộ phận ----
    // Cả bộ tiêu chí của một vị trí luôn được cập nhật cùng lúc bằng một câu UPDATE nên mọi dòng
    // mang cùng giá trị; đọc ra thì lấy dòng có ReviewedAt mới nhất (đầu file V055 giải thích vì
    // sao không tách thành bảng "lượt duyệt" riêng).

    /// <summary>Lượt gửi duyệt gần nhất.</summary>
    [Column("submitted_at")]
    public DateTime? SubmittedAt { get; set; }
    [Column("submitted_by")]
    public long? SubmittedBy { get; set; }

    /// <summary>Lượt Trưởng bộ phận xử lý gần nhất (duyệt hoặc trả về).</summary>
    [Column("reviewed_at")]
    public DateTime? ReviewedAt { get; set; }
    [Column("reviewed_by")]
    public long? ReviewedBy { get; set; }

    /// <summary>Lý do Trưởng bộ phận TRẢ BỘ TIÊU CHÍ VỀ. Chỉ có nghĩa ở nhánh trả về.</summary>
    [Column("review_note")]
    public string? ReviewNote { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}