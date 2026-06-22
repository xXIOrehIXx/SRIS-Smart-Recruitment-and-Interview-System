using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Offer (docs 5.15). Người quyết tuyển chốt offer tại cửa INTERVIEW->OFFER:
/// tạo OfferDetail (PENDING) + đẩy state sang OFFER (qua Guard G2) + phát magic link OFFER_RESPONSE.
/// Ứng viên tự nhận/từ chối ở ICandidateOfferService (CandidatePortal).
/// </summary>
public interface IOfferService : IBaseService
{
    /// <summary>
    /// Chốt offer cho hồ sơ đang ở INTERVIEW. Phân quyền: chỉ Department Manager của job
    /// (job không gán DM -> bất kỳ user đăng nhập = Recruiter). Trả offer + magic token (1 lần).
    /// </summary>
    Task<MakeOfferResultDto> MakeOfferAsync(long companyId, long userId, long applicationId, MakeOfferDto dto);

    /// <summary>Offer của 1 hồ sơ (null nếu chưa ra offer).</summary>
    Task<OfferDto?> GetByApplicationAsync(long companyId, long applicationId);
}
