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
    /// Ghi phản hồi của ứng viên (ACCEPTED/DECLINED) + responded_at — chỉ khi đang PENDING
    /// (khóa lạc quan chống double-submit). Trả số dòng (0 = đã phản hồi rồi/không thấy).
    /// </summary>
    Task<int> SetResponseAsync(long companyId, long offerId, string status, DateTime respondedAt);
}
