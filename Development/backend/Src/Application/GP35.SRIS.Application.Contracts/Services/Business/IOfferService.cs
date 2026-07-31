using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Offer (docs 5.15). Recruiter tạo OfferDetail (PENDING) cho hồ sơ đang ở trạng thái OFFER 
/// (đã được DM duyệt) + phát magic link OFFER_RESPONSE.
/// Ứng viên tự nhận/từ chối ở ICandidateOfferService (CandidatePortal).
/// </summary>
public interface IOfferService : IBaseService
{
    /// <summary>
    /// Tạo offer cho hồ sơ đang ở trạng thái OFFER (đã được duyệt bởi DM).
    /// Người gọi (Recruiter) chốt lương/ngày bắt đầu, sau đó hệ thống tạo OfferDetail và phát magic link OFFER_RESPONSE.
    /// </summary>
    Task<MakeOfferResultDto> MakeOfferAsync(long companyId, long userId, long applicationId, MakeOfferDto dto);

    /// <summary>Offer của 1 hồ sơ (null nếu chưa ra offer).</summary>
    Task<OfferDto?> GetByApplicationAsync(long companyId, long applicationId);
}
