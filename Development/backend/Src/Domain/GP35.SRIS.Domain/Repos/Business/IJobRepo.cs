using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

public interface IJobRepo : IBaseRepo<long, Job>
{
    /// <summary>Tạo Job mới (set company_id, trả về job_id IDENTITY).</summary>
    Task<long> InsertAsync(long companyId, Job job);

    /// <summary>Danh sách Job của công ty (Global Query Filter tự kèm company_id).</summary>
    Task<IEnumerable<Job>> GetListByCompanyAsync(long companyId);

    /// <summary>1 Job theo id (lọc theo company). Dùng để đọc department_manager_id ở bước offer.</summary>
    Task<Job?> GetByIdAsync(long companyId, long jobId);

    /// <summary>Cập nhật Job. Trả số dòng (0 = không thấy).</summary>
    Task<int> UpdateAsync(long companyId, long jobId, string title, string? jdText,
        long? departmentManagerId, string status);

    /// <summary>
    /// V020: Cập nhật Job đầy đủ field (department, location, salary, deadline...). Trả số dòng.
    /// </summary>
    Task<int> UpdateExtendedAsync(long companyId, long jobId, Job job);

    /// <summary>API CÔNG KHAI: Lấy tất cả job đang tuyển (Status = 'Open').</summary>
    Task<IEnumerable<Job>> GetPublicOpenJobsAsync();

    /// <summary>API CÔNG KHAI: Lấy 1 job đang tuyển theo id.</summary>
    Task<Job?> GetPublicOpenJobAsync(long jobId);

    /* ===== V020: yêu cầu + quyền lợi (1-N) ===== */

    /// <summary>Lấy danh sách yêu cầu theo thứ tự ordinal.</summary>
    Task<IReadOnlyList<JobRequirement>> GetRequirementsAsync(long companyId, long jobId);

    /// <summary>Lấy danh sách quyền lợi theo thứ tự ordinal.</summary>
    Task<IReadOnlyList<JobBenefit>> GetBenefitsAsync(long companyId, long jobId);

    /// <summary>Xóa toàn bộ yêu cầu cũ rồi chèn lại theo danh sách mới (transaction).</summary>
    Task ReplaceRequirementsAsync(long companyId, long jobId, IReadOnlyList<string> contents);

    /// <summary>Xóa toàn bộ quyền lợi cũ rồi chèn lại theo danh sách mới (transaction).</summary>
    Task ReplaceBenefitsAsync(long companyId, long jobId, IReadOnlyList<string> contents);

    /// <summary>
    /// Worker JobExpiry cần nhận diện các job Open đã quá hạn (deadline &lt; UTC hôm nay) của
    /// MỌI công ty. Method này chạy trong scope đặc biệt KHÔNG có <c>companyId</c> tenant
    /// (worker phải tự set trước khi gọi), nên dùng raw SQL bypass RLS. Trả danh sách kèm
    /// companyId để worker loop từng entry và set tenant trước khi đóng job từng cái.
    /// </summary>
    Task<IReadOnlyList<ExpiredJobRef>> GetExpiredOpenJobsAsync(CancellationToken ct = default);
}

/// <summary>1 job Open đã quá hạn — cho JobExpiryWorker close hàng loạt.</summary>
public record ExpiredJobRef(long CompanyId, long JobId, string Title, DateTime Deadline);
