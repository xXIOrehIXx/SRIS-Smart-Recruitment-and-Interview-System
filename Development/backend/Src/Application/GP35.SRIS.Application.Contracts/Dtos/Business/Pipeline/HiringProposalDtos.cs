namespace GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

/// <summary>Trưởng bộ phận đề xuất tuyển một ứng viên (docs 5.14 — V043).</summary>
public class CreateProposalDto
{
    /// <summary>Vì sao nên tuyển người này — căn cứ để Giám đốc quyết.</summary>
    public string? Note { get; set; }

    /// <summary>
    /// Mức lương đề xuất — BẮT BUỘC (V053). Đó là con số điền sẵn vào ô lương khi Giám đốc
    /// duyệt: phiếu trống thì Giám đốc phải tự nghĩ một mức từ đầu, không có căn cứ của bộ phận.
    /// </summary>
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

    /// <summary>
    /// Ghi chú quyết định. BẮT BUỘC khi CHƯA duyệt: phiếu quay về bàn Trưởng bộ phận, không ghi
    /// thì họ không biết vì sao.
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Mức lương Giám đốc CHỐT (V057, 15/09/2026). Bỏ trống = giữ đúng mức DM đề xuất. Giám đốc
    /// không ưng mức đề xuất thì sửa ngay ở đây rồi duyệt — không phải trả phiếu về chờ DM gõ
    /// hộ con số mình đã biết. Chỉ đọc khi <see cref="Approve"/> = true.
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

    /// <summary>Mức lương DM đề xuất.</summary>
    public decimal? ProposedSalary { get; set; }
    public long? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime? CreatedAt { get; set; }

    public string? DecisionNote { get; set; }

    /// <summary>Mức lương Giám đốc CHỐT (chỉ có ở phiếu APPROVED) — thư mời lấy số này.</summary>
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

    /// <summary>
    /// Khung lương ĐĂNG TRÊN TIN tuyển dụng (Job.salary_min/max) — không phải mức đề xuất.
    /// Màn duyệt của Giám đốc đối chiếu con số sắp chốt với khoảng này rồi CẢNH BÁO nếu lệch:
    /// đó là mức đã hứa công khai với ứng viên, chốt ra ngoài mà không biết thì đến lúc gửi
    /// thư mời mới vỡ. Chỉ cảnh báo — quyền chốt lương vẫn là của Giám đốc (V057).
    /// Tin không ghi lương thì cả hai NULL và màn duyệt bỏ phần đối chiếu.
    /// </summary>
    public decimal? JobSalaryMin { get; set; }
    public decimal? JobSalaryMax { get; set; }
    public string? JobCurrency { get; set; }

    /// <summary>
    /// Khung lương trong YÊU CẦU TUYỂN DỤNG đã sinh ra tin này — chỉ dùng khi tin đăng
    /// "lương thỏa thuận" (<see cref="JobSalaryMin"/>/<see cref="JobSalaryMax"/> đều NULL).
    /// Đây là ngân sách NỘI BỘ Giám đốc đã duyệt lúc duyệt yêu cầu, KHÔNG phải con số đã hứa
    /// công khai với ứng viên — màn duyệt phải nói rõ sự khác nhau đó khi cảnh báo.
    /// </summary>
    public decimal? RequestSalaryMin { get; set; }
    public decimal? RequestSalaryMax { get; set; }

    /// <summary>Trạng thái hiện tại của hồ sơ (INTERVIEW/OFFER/...) — phát hiện phiếu đã lỗi thời.</summary>
    public string ApplicationState { get; set; } = null!;
}
