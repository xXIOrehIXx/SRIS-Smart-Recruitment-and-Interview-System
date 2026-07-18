using GP35.SRIS.Application.Contracts.Dtos.Business.Request;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Yêu cầu tuyển dụng (docs 5.17): DM ra đề (tùy chọn) → Recruiter duyệt → tạo Job từ yêu cầu.
/// PENDING → APPROVED → CONVERTED · PENDING → REJECTED · PENDING → CANCELLED (DM tự hủy).
/// </summary>
public interface IRecruitmentRequestService : IBaseService
{
    Task<RecruitmentRequestDto> CreateAsync(long companyId, long userId, RecruitmentRequestInputDto dto);

    Task<IReadOnlyList<RecruitmentRequestDto>> GetListAsync(long companyId, string? status);

    Task<RecruitmentRequestDto> GetByIdAsync(long companyId, long requestId);

    /// <summary>Sửa yêu cầu — chỉ khi còn PENDING.</summary>
    Task<RecruitmentRequestDto> UpdateAsync(long companyId, long userId, long requestId, RecruitmentRequestInputDto dto);

    /// <summary>DM hủy yêu cầu của mình — chỉ khi còn PENDING.</summary>
    Task CancelAsync(long companyId, long userId, long requestId);

    /// <summary>Recruiter duyệt: APPROVED / REJECTED (kèm note, ghi ai duyệt).</summary>
    Task<RecruitmentRequestDto> ReviewAsync(long companyId, long userId, long requestId, ReviewRequestDto dto);

    /// <summary>Recruiter đã tạo Job từ yêu cầu -> CONVERTED + job_id.</summary>
    Task<RecruitmentRequestDto> ConvertAsync(long companyId, long userId, long requestId, ConvertRequestDto dto);
}
