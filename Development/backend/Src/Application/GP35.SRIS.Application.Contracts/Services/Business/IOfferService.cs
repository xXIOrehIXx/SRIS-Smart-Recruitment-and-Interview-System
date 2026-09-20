using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Thư mời nhận việc (docs 5.15). Human Resource/DM soạn thư cho hồ sơ đang ở trạng thái OFFER →
/// hệ thống lưu OfferDetail (PENDING = đã gửi) + gửi email kèm link mở file PDF thư mời.
///
/// Ứng viên KHÔNG bấm đồng ý/từ chối trong hệ thống — họ trả lời ngoài hệ thống (email/điện
/// thoại), sau đó Human Resource/DM vào Portal ghi nhận kết quả qua <see cref="RecordOutcomeAsync"/>
/// → đồng bộ Application sang HIRED/REJECTED.
/// </summary>
public interface IOfferService : IBaseService
{
    /// <summary>
    /// Giá trị gợi ý để mở sẵn form soạn thư (lấy từ Job + Company + hồ sơ ứng viên).
    /// Chỉ đọc, không ghi gì vào DB.
    /// </summary>
    Task<OfferLetterDefaultsDto> GetLetterDefaultsAsync(long companyId, long applicationId);

    /// <summary>
    /// Soạn + gửi thư mời nhận việc cho hồ sơ đang ở trạng thái OFFER (đã được người quyết duyệt).
    /// Tạo OfferDetail (PENDING) và phát magic link để ứng viên mở file PDF thư mời.
    /// </summary>
    Task<MakeOfferResultDto> MakeOfferAsync(long companyId, long userId, long applicationId, MakeOfferDto dto);

    /// <summary>Offer của 1 hồ sơ (null nếu chưa gửi thư mời).</summary>
    Task<OfferDto?> GetByApplicationAsync(long companyId, long applicationId);

    /// <summary>
    /// Danh sách hồ sơ đã tới bước thư mời (chờ soạn thư + đã gửi), MỘT lời gọi cho cả công ty.
    /// <paramref name="jobId"/> null = mọi vị trí.
    /// </summary>
    Task<IReadOnlyList<OfferListItemDto>> GetListAsync(long companyId, long? jobId);

    /// <summary>File PDF thư mời của 1 hồ sơ (bản Portal xem lại). Null nếu chưa có offer.</summary>
    Task<(byte[] Content, string FileName)?> GetLetterPdfAsync(long companyId, long applicationId);

    /// <summary>
    /// Ghi nhận kết quả ứng viên trả lời ngoài hệ thống: nhận việc → ACCEPTED + HIRED,
    /// từ chối → DECLINED + REJECTED.
    /// </summary>
    Task<OfferOutcomeResultDto> RecordOutcomeAsync(
        long companyId, long userId, long applicationId, OfferOutcomeDto dto);

    /// <summary>
    /// Danh sách file đính kèm của thư mời (bản scan hợp đồng đã ký — V058), mới nhất lên đầu.
    /// Mỗi dòng kèm link presigned sinh mới, hết hạn ~1 giờ.
    /// </summary>
    Task<IReadOnlyList<OfferAttachmentDto>> GetAttachmentsAsync(long companyId, long applicationId);

    /// <summary>
    /// Đính kèm 1 file cho thư mời. KHÔNG đụng tới trạng thái hồ sơ: đây là lưu bằng chứng giấy
    /// tờ, không phải một quyết định — đính kèm được cả trước và sau khi ghi nhận nhận việc.
    /// </summary>
    Task<OfferAttachmentDto> AddAttachmentAsync(
        long companyId, long userId, long applicationId,
        string fileName, string? mimeType, byte[] content, string? note, string? kind);

    /// <summary>Gỡ 1 file đính kèm (upload nhầm). Trả false nếu không tìm thấy.</summary>
    Task<bool> DeleteAttachmentAsync(long companyId, long applicationId, long attachmentId);
}
