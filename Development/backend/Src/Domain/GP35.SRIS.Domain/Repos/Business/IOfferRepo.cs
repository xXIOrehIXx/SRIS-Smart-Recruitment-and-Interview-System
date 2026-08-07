using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>OfferDetail — 0..1 / Application (UNIQUE application_id). Một offer / một hồ sơ (docs 5.15).</summary>
public interface IOfferRepo : IBaseRepo<long, OfferDetail>
{
    /// <summary>Offer của 1 hồ sơ (null nếu chưa có).</summary>
    Task<OfferDetail?> GetByApplicationAsync(long companyId, long applicationId);

    /// <summary>Tạo offer mới (set company_id, trả về offer_id IDENTITY).</summary>
    Task<long> InsertAsync(long companyId, OfferDetail offer);

    /// <summary>
    /// Recruiter/DM ghi nhận kết quả ứng viên trả lời NGOÀI hệ thống (ACCEPTED/DECLINED) +
    /// responded_at — chỉ khi đang PENDING (khóa lạc quan chống hai người bấm cùng lúc).
    /// Trả số dòng (0 = đã chốt trước đó/không thấy).
    /// </summary>
    Task<int> SetOutcomeAsync(
        long companyId, long offerId, string status, long? outcomeBy, string? note, DateTime respondedAt);
}
