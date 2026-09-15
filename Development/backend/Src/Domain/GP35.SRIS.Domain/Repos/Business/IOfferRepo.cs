using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// 1 dòng màn Thư mời: hồ sơ đã tới bước thư mời + ứng viên + vị trí, kèm thư đã gửi (null =
/// Giám đốc đã duyệt tuyển nhưng nhân sự CHƯA soạn thư). Join sẵn để màn danh sách không phải
/// gọi thêm một API cho từng hồ sơ.
/// </summary>
public record OfferListRow(
    long ApplicationId,
    long JobId,
    string JobTitle,
    string CandidateName,
    string CandidateEmail,
    string ApplicationState,
    OfferDetail? Offer);

/// <summary>OfferDetail — 0..1 / Application (UNIQUE application_id). Một offer / một hồ sơ (docs 5.15).</summary>
public interface IOfferRepo : IBaseRepo<long, OfferDetail>
{
    /// <summary>Offer của 1 hồ sơ (null nếu chưa có).</summary>
    Task<OfferDetail?> GetByApplicationAsync(long companyId, long applicationId);

    /// <summary>
    /// Hồ sơ ĐÃ TỚI bước thư mời: đang ở OFFER (chờ soạn thư) hoặc đã có thư (kể cả đã
    /// nhận việc / từ chối). KHÔNG lấy mọi hồ sơ REJECTED — người bị loại từ vòng sàng lọc chẳng
    /// liên quan gì tới thư mời. <paramref name="jobId"/> null = mọi vị trí của công ty.
    /// </summary>
    Task<IReadOnlyList<OfferListRow>> GetListAsync(long companyId, long? jobId);

    /// <summary>Tạo offer mới (set company_id, trả về offer_id IDENTITY).</summary>
    Task<long> InsertAsync(long companyId, OfferDetail offer);

    /// <summary>
    /// Human Resource/DM ghi nhận kết quả ứng viên trả lời NGOÀI hệ thống (ACCEPTED/DECLINED) +
    /// responded_at — chỉ khi đang PENDING (khóa lạc quan chống hai người bấm cùng lúc).
    /// Trả số dòng (0 = đã chốt trước đó/không thấy).
    /// </summary>
    Task<int> SetOutcomeAsync(
        long companyId, long offerId, string status, long? outcomeBy, string? note, DateTime respondedAt);
}
