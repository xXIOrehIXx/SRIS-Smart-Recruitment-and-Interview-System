using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Phiếu ĐỀ XUẤT TUYỂN (V043, chốt 15/08/2026) — Trưởng bộ phận đọc kết luận hội đồng phỏng vấn
/// rồi đề xuất "nên tuyển người này" KÈM mức lương; GIÁM ĐỐC duyệt và CHỐT mức lương
/// (<see cref="ApprovedSalary"/> — giữ nguyên mức đề xuất hoặc sửa ngay lúc duyệt), hoặc trả
/// phiếu về. V057 (15/09/2026) đảo lại V053: bắt Giám đốc trả phiếu về chỉ để DM gõ hộ con số
/// họ đã biết là một vòng đi-về thừa. Ngày vào làm KHÔNG nằm ở đây (bỏ 24/08/2026): nhân sự
/// chốt ngày với ứng viên rồi điền vào thư mời.
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

    /// <summary>Mức lương DM đề xuất (bắt buộc). Chỉ là đề xuất — thư mời đọc <see cref="ApprovedSalary"/>.</summary>
    [Column("proposed_salary")]
    public decimal? ProposedSalary { get; set; }


    /// <summary>DM đề xuất.</summary>
    [Column("created_by")]
    public long? CreatedBy { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    // ----- Quyết định của Giám đốc -----

    /// <summary>
    /// Ghi chú quyết định. Bắt buộc khi CHƯA duyệt: phiếu quay về bàn Trưởng bộ phận và đây là
    /// thứ họ đọc để biết vì sao.
    /// </summary>
    [Column("decision_note")]
    public string? DecisionNote { get; set; }

    /// <summary>
    /// Mức lương Giám đốc CHỐT khi duyệt (V057) — có thể khác mức đề xuất; là con số DUY NHẤT
    /// thư mời dùng. Chỉ có giá trị khi phiếu APPROVED.
    /// </summary>
    [Column("approved_salary")]
    public decimal? ApprovedSalary { get; set; }

    /// <summary>Giám đốc quyết.</summary>
    [Column("decided_by")]
    public long? DecidedBy { get; set; }

    [Column("decided_at")]
    public DateTime? DecidedAt { get; set; }
}
