using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Phiếu ĐỀ XUẤT TUYỂN (V043, chốt 15/08/2026) — Trưởng bộ phận đọc kết luận hội đồng phỏng vấn
/// rồi đề xuất "nên tuyển người này" KÈM mức lương; GIÁM ĐỐC duyệt hoặc trả lại phiếu.
///
/// Trên phiếu chỉ có MỘT con số lương (<see cref="ProposedSalary"/>): Giám đốc KHÔNG gõ đè
/// mức khác (bỏ approved_salary — V053, 25/08/2026). Không ưng thì CHƯA DUYỆT kèm
/// <see cref="DecisionNote"/> nói rõ muốn bao nhiêu, DM sửa phiếu rồi gửi lại. Ngày vào làm
/// cũng KHÔNG nằm ở đây (bỏ 24/08/2026): nhân sự chốt ngày với ứng viên rồi điền vào thư mời.
///
/// Đối xứng với <see cref="RecruitmentRequest"/>: đầu quy trình DM ra đề — nhân sự duyệt;
/// cuối quy trình DM đề xuất — Giám đốc duyệt.
/// </summary>
public class HiringProposal : BaseEntity<long>, IHasCreateInfo, IHasCompanyInfo
{
    [Key]
    [Column("proposal_id")]
    public long ProposalId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }

    [Column("application_id")]
    public long ApplicationId { get; set; }

    /// <summary>PENDING | APPROVED | REJECTED. Từ chối KHÔNG loại ứng viên — hồ sơ ở lại bước Phỏng vấn.</summary>
    [Column("status")]
    public string Status { get; set; } = "PENDING";

    // ----- Đề xuất của Trưởng bộ phận -----

    /// <summary>Vì sao nên tuyển người này (căn cứ Giám đốc đọc để quyết).</summary>
    [Column("proposal_note")]
    public string? ProposalNote { get; set; }

    /// <summary>Mức lương đề xuất — phiếu được duyệt thì đây LÀ mức thư mời dùng (V053).</summary>
    [Column("proposed_salary")]
    public decimal? ProposedSalary { get; set; }


    /// <summary>DM đề xuất.</summary>
    [Column("created_by")]
    public long? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    // ----- Quyết định của Giám đốc -----

    /// <summary>
    /// Ghi chú quyết định. Khi CHƯA duyệt thì đây là kênh DUY NHẤT Giám đốc nói cho Trưởng bộ
    /// phận biết phải sửa gì (thường là mức lương) — vì vậy bắt buộc nhập ở nhánh đó (V053).
    /// </summary>
    [Column("decision_note")]
    public string? DecisionNote { get; set; }

    /// <summary>Giám đốc quyết.</summary>
    [Column("decided_by")]
    public long? DecidedBy { get; set; }

    [Column("decided_at")]
    public DateTime? DecidedAt { get; set; }
}
