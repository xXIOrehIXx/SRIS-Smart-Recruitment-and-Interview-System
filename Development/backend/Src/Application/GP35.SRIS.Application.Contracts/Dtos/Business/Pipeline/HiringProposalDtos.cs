namespace GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

/// <summary>Trưởng bộ phận đề xuất tuyển một ứng viên (docs 5.14 — V043).</summary>
public class CreateProposalDto
{
    /// <summary>Vì sao nên tuyển người này — căn cứ để Giám đốc quyết.</summary>
    public string? Note { get; set; }

    /// <summary>Mức lương ĐỀ XUẤT (tùy chọn). Giám đốc có quyền chốt mức khác.</summary>
    public decimal? ProposedSalary { get; set; }

    // Ngày vào làm đã BỎ khỏi phiếu đề xuất (24/08/2026): Giám đốc quyết TIỀN, không quyết ngày.
    // Ngày onboard là kết quả một cuộc gọi giữa nhân sự và ứng viên (họ còn phải báo trước cho
    // chỗ làm cũ), nên nó được nhập ở thư mời — OfferDetail.StartDate. Đặt ở đây chỉ tạo một
    // con số phải đoán từ trước cả tuần rồi luôn sai.
}

/// <summary>Giám đốc quyết một đề xuất. Duyệt = hồ sơ sang bước Quyết định (OFFER).</summary>
public class DecideProposalDto
{
    public bool Approve { get; set; }

    /// <summary>Ghi chú quyết định (tùy chọn) — lý do duyệt / vì sao chưa duyệt.</summary>
    public string? Note { get; set; }

    /// <summary>
    /// Mức lương CHỐT. Bỏ trống khi duyệt thì lấy mức DM đề xuất. Đây là con số thư mời dùng,
    /// nên bộ phận nhân sự không phải hỏi lại Giám đốc "chốt bao nhiêu".
    /// </summary>
    public decimal? ApprovedSalary { get; set; }

}

/// <summary>Một phiếu đề xuất tuyển (kèm thông tin ứng viên/vị trí để hiển thị thẳng).</summary>
public class HiringProposalDto
{
    public long ProposalId { get; set; }
    public long ApplicationId { get; set; }

    /// <summary>PENDING | APPROVED | REJECTED.</summary>
    public string Status { get; set; } = null!;

    public string? ProposalNote { get; set; }
    public decimal? ProposedSalary { get; set; }
    public long? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime? CreatedAt { get; set; }

    public string? DecisionNote { get; set; }
    public decimal? ApprovedSalary { get; set; }
    public long? DecidedBy { get; set; }
    public string? DecidedByName { get; set; }
    public DateTime? DecidedAt { get; set; }

    // Thông tin hồ sơ (join sẵn) — hàng đợi của Giám đốc hiển thị được ngay.
    public string CandidateName { get; set; } = null!;
    public string CandidateEmail { get; set; } = null!;
    public long JobId { get; set; }
    public string JobTitle { get; set; } = null!;
    public string? Department { get; set; }

    /// <summary>Trạng thái hiện tại của hồ sơ (INTERVIEW/OFFER/...) — phát hiện phiếu đã lỗi thời.</summary>
    public string ApplicationState { get; set; } = null!;
}
