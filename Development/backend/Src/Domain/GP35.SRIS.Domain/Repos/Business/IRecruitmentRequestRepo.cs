using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 dòng danh sách yêu cầu tuyển dụng kèm email/tên người tạo (join User).</summary>
public record RecruitmentRequestRow(RecruitmentRequest Request, string? CreatedByName, string? ReviewedByName);

public interface IRecruitmentRequestRepo : IBaseRepo<long, RecruitmentRequest>
{
    /// <summary>Tạo yêu cầu, trả request_id.</summary>
    Task<long> InsertAsync(long companyId, RecruitmentRequest request);

    /// <summary>Danh sách yêu cầu của công ty (mới nhất trước), lọc status tùy chọn.</summary>
    Task<IReadOnlyList<RecruitmentRequestRow>> GetListAsync(long companyId, string? status);

    /// <summary>1 yêu cầu theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<RecruitmentRequest?> GetByIdAsync(long companyId, long requestId);

    /// <summary>Lưu thay đổi trên entity đang track (service sửa field xong gọi).</summary>
    Task SaveAsync();
}
