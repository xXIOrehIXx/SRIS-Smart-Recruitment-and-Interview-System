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
    string ApplicationState,
    // Khung lương ĐĂNG TRÊN TIN (Job.salary_min/max) — join sẵn để lúc duyệt, Giám đốc thấy
    // ngay mức mình sắp chốt nằm trong hay ngoài khoảng đã hứa với ứng viên ở tin tuyển dụng.
    decimal? JobSalaryMin,
    decimal? JobSalaryMax,
    string? JobCurrency,
    // Khung lương trong YÊU CẦU TUYỂN DỤNG đã sinh ra tin này (RecruitmentRequest.job_id).
    // Dùng khi tin đăng "lương thỏa thuận" (hai cột trên NULL): công ty không muốn công khai
    // lương, nhưng bên trong DM vẫn ghi ngân sách và Giám đốc đã duyệt chính con số đó — vẫn có
    // cái để đối chiếu, chỉ là khung NỘI BỘ chứ không phải lời hứa với ứng viên.
    decimal? RequestSalaryMin,
    decimal? RequestSalaryMax);

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
