using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// File đính kèm thư mời (bản scan hợp đồng đã ký — V058). Nhiều dòng / một offer, mới nhất
/// lên đầu: đây là LỊCH SỬ giấy tờ, upload lại không đè bản cũ.
/// </summary>
public interface IOfferAttachmentRepo : IBaseRepo<long, OfferAttachment>
{
    /// <summary>Mọi file đính kèm của một hồ sơ, mới nhất lên đầu.</summary>
    Task<IReadOnlyList<OfferAttachment>> GetByApplicationAsync(long companyId, long applicationId);

    /// <summary>1 file theo id (null nếu không thấy / khác tenant).</summary>
    Task<OfferAttachment?> GetByIdAsync(long companyId, long attachmentId);

    /// <summary>Thêm 1 file (set company_id, trả về attachment_id IDENTITY).</summary>
    Task<long> InsertAsync(long companyId, OfferAttachment attachment);

    /// <summary>Gỡ 1 file khỏi danh sách (upload nhầm). Trả số dòng đã xóa.</summary>
    Task<int> DeleteAsync(long companyId, long attachmentId);
}
