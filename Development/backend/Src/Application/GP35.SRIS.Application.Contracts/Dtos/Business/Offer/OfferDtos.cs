namespace GP35.SRIS.Application.Contracts.Dtos.Business.Offer;

/// <summary>
/// Người quyết tuyển (Department Manager của job; job không gán DM -> Recruiter) chốt offer
/// tại cửa INTERVIEW->OFFER (docs 5.15). Tạo OfferDetail + đẩy state sang OFFER + phát link OFFER_RESPONSE.
/// </summary>
public class MakeOfferDto
{
    public decimal? SalaryAmount { get; set; }
    public string? Currency { get; set; }            // null -> mặc định "VND"
    public DateTime? StartDate { get; set; }
    public string? Note { get; set; }
    public int? ExpiresInDays { get; set; }          // null -> mặc định TTL link OFFER_RESPONSE (7 ngày)
}

/// <summary>1 offer (góc nhìn nội bộ Portal).</summary>
public class OfferDto
{
    public long OfferId { get; set; }
    public long ApplicationId { get; set; }
    public decimal? SalaryAmount { get; set; }
    public string Currency { get; set; } = null!;
    public DateTime? StartDate { get; set; }
    public string Status { get; set; } = null!;
    public string? Note { get; set; }
    public long? DecidedBy { get; set; }
    public DateTime? SentAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? RespondedAt { get; set; }
}

/// <summary>Kết quả ra offer: offer vừa tạo + magic link OFFER_RESPONSE để gửi ứng viên (token gốc 1 lần).</summary>
public class MakeOfferResultDto
{
    public OfferDto Offer { get; set; } = null!;
    public string MagicToken { get; set; } = null!;
    public DateTime TokenExpiresAt { get; set; }
}
