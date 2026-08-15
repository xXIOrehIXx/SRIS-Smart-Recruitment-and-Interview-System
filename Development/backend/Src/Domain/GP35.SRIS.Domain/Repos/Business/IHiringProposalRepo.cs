using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// 1 dòng hàng đợi đề xuất tuyển: phiếu + tên người đề xuất/người quyết + thông tin ứng viên
/// và vị trí (join sẵn, để màn Giám đốc không phải gọi thêm API cho từng dòng).
/// </summary>
public record HiringProposalRow(
    HiringProposal Proposal,
    string? CreatedByName,
    string? DecidedByName,
    string CandidateName,
    string CandidateEmail,
    long JobId,
    string JobTitle,
    string? Department,
    string ApplicationState);

public interface IHiringProposalRepo : IBaseRepo<long, HiringProposal>
{
    /// <summary>Tạo đề xuất, trả proposal_id.</summary>
    Task<long> InsertAsync(long companyId, HiringProposal proposal);

    /// <summary>Danh sách đề xuất của công ty (mới nhất trước), lọc status tùy chọn.</summary>
    Task<IReadOnlyList<HiringProposalRow>> GetListAsync(long companyId, string? status);

    /// <summary>Đề xuất theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<HiringProposal?> GetByIdAsync(long companyId, long proposalId);

    /// <summary>Mọi đề xuất của 1 hồ sơ, mới nhất trước (hồ sơ bị từ chối rồi đề xuất lại).</summary>
    Task<IReadOnlyList<HiringProposal>> GetByApplicationAsync(long companyId, long applicationId);

    /// <summary>Đề xuất ĐANG CHỜ của 1 hồ sơ (tối đa 1 — UX_HiringProp_pending). Null nếu không có.</summary>
    Task<HiringProposal?> GetPendingByApplicationAsync(long companyId, long applicationId);

    /// <summary>
    /// Đề xuất ĐÃ DUYỆT gần nhất của 1 hồ sơ — nguồn điều khoản (lương, ngày vào làm) cho thư mời.
    /// </summary>
    Task<HiringProposal?> GetApprovedByApplicationAsync(long companyId, long applicationId);

    /// <summary>Lưu thay đổi trên entity đang track (service sửa field xong gọi).</summary>
    Task SaveAsync();
}
