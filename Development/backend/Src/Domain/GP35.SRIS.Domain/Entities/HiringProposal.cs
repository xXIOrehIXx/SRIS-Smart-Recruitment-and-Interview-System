using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Phiếu ĐỀ XUẤT TUYỂN (V043, chốt 15/08/2026) — Trưởng bộ phận đọc kết luận hội đồng phỏng vấn
/// rồi đề xuất "nên tuyển người này"; GIÁM ĐỐC là người quyết và chốt điều khoản
/// (<see cref="ApprovedSalary"/> / <see cref="ApprovedStartDate"/>) để nhân sự soạn thư mời.
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

    [Column("proposed_salary")]
    public decimal? ProposedSalary { get; set; }

    [Column("proposed_start_date")]
    public DateTime? ProposedStartDate { get; set; }

    /// <summary>DM đề xuất.</summary>
    [Column("created_by")]
    public long? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    // ----- Quyết định của Giám đốc -----

    [Column("decision_note")]
    public string? DecisionNote { get; set; }

    /// <summary>Mức lương CHỐT — có thể khác mức DM đề xuất; là thứ thư mời lấy ra dùng.</summary>
    [Column("approved_salary")]
    public decimal? ApprovedSalary { get; set; }

    [Column("approved_start_date")]
    public DateTime? ApprovedStartDate { get; set; }

    /// <summary>Giám đốc quyết.</summary>
    [Column("decided_by")]
    public long? DecidedBy { get; set; }

    [Column("decided_at")]
    public DateTime? DecidedAt { get; set; }
}
