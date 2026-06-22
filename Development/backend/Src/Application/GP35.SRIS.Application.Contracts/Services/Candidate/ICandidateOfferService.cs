using GP35.SRIS.Application.Contracts.Dtos.Candidate.Offer;

namespace GP35.SRIS.Application.Contracts.Services.CandidatePortal;

/// <summary>
/// Ứng viên tự nhận/từ chối offer qua magic link OFFER_RESPONSE (docs 5.15). Không login.
/// Đồng ý -> OfferDetail ACCEPTED + Application HIRED; Từ chối -> DECLINED + REJECTED. One-time đốt token khi chốt.
/// </summary>
public interface ICandidateOfferService : IBaseService
{
    /// <summary>Trang xem offer: lương/ngày vào làm/hạn phản hồi (chỉ nội dung cần để quyết).</summary>
    Task<CandidateOfferDto> GetOfferAsync(string rawToken);

    /// <summary>Phản hồi offer (Đồng ý/Từ chối). Trả lỗi 409 nếu đã phản hồi hoặc offer hết hạn.</summary>
    Task<OfferResponseResultDto> RespondAsync(string rawToken, OfferResponseDto dto);
}
