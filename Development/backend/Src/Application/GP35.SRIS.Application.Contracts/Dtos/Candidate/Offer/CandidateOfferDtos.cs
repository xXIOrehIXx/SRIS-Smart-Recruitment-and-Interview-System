namespace GP35.SRIS.Application.Contracts.Dtos.Candidate.Offer;

/// <summary>
/// Offer như ứng viên thấy qua magic link OFFER_RESPONSE (docs 5.15) — chỉ nội dung cần để quyết:
/// lương / tiền tệ / ngày vào làm / hạn phản hồi. Không lộ thông tin nội bộ (decided_by, note).
/// </summary>
public class CandidateOfferDto
{
    public decimal? SalaryAmount { get; set; }
    public string Currency { get; set; } = null!;
    public DateTime? StartDate { get; set; }
    public string Status { get; set; } = null!;
    public DateTime? ExpiresAt { get; set; }
}

/// <summary>Ứng viên bấm Đồng ý/Từ chối offer.</summary>
public class OfferResponseDto
{
    public bool Accept { get; set; }
}

/// <summary>Kết quả phản hồi: trạng thái offer mới + state pipeline tương ứng.</summary>
public class OfferResponseResultDto
{
    public string OfferStatus { get; set; } = null!;       // ACCEPTED / DECLINED
    public string ApplicationState { get; set; } = null!;  // HIRED / REJECTED
}
