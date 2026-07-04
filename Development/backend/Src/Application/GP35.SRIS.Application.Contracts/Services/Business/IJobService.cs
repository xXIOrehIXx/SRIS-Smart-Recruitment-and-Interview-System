using GP35.SRIS.Application.Contracts.Dtos;

namespace GP35.SRIS.Application.Contracts;

public interface IJobService : IBaseService
{
    /// <summary>Tạo Job mới cho công ty hiện tại. <paramref name="createdBy"/> = user đang đăng nhập (Recruiter).</summary>
    Task<JobGetDto> CreateAsync(long companyId, long createdBy, JobCreateDto dto);

    /// <summary>Danh sách Job của công ty (mới nhất trước).</summary>
    Task<IEnumerable<JobGetDto>> GetListAsync(long companyId);

    /// <summary>API CÔNG KHAI: Danh sách job đang tuyển (không cần login).</summary>
    Task<IEnumerable<JobGetDto>> GetPublicJobsAsync();

    /// <summary>API CÔNG KHAI: Chi tiết 1 job đang tuyển (không cần login).</summary>
    Task<JobGetDto?> GetPublicJobAsync(long jobId);
}
