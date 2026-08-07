namespace GP35.SRIS.Application.Contracts.Dtos.Candidate.Offer;

/// <summary>
/// Thư mời nhận việc như ứng viên thấy qua magic link OFFER_RESPONSE (docs 5.15).
/// Chỉ là bản tóm tắt để hiện trên trang trước khi tải PDF — KHÔNG lộ thông tin nội bộ
/// (decided_by, ghi chú nội bộ, outcome). Ứng viên không thao tác gì trên trang này:
/// không có nút Đồng ý/Từ chối, họ trả lời nhà tuyển dụng ngoài hệ thống.
/// </summary>
public class CandidateOfferDto
{
    public string? CompanyName { get; set; }
    public string? CandidateName { get; set; }
    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public DateTime? StartDate { get; set; }
    public string? EmploymentType { get; set; }
    public string? WorkLocation { get; set; }

    public decimal? SalaryAmount { get; set; }
    public string Currency { get; set; } = null!;
    /// <summary>"THANG" | "NAM" — kỳ lương, để trang hiển thị "/tháng" hay "/năm".</summary>
    public string? SalaryPeriod { get; set; }

    /// <summary>Người liên hệ nếu ứng viên có câu hỏi (in cả trên thư).</summary>
    public string? HrContactName { get; set; }
    public string? HrContactEmail { get; set; }

    /// <summary>Hạn nhà tuyển dụng mong nhận trả lời (cũng là hạn của link xem thư).</summary>
    public DateTime? ExpiresAt { get; set; }
}
