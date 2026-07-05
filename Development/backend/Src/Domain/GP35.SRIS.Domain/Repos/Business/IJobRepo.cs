using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Thông tin tối thiểu của Job phục vụ chấm điểm (KHÔNG đọc cột VECTOR ra .NET).</summary>
public record JobEmbeddingInfo(long JobId, string? JdText, bool HasEmbedding);

public interface IJobRepo : IBaseRepo<long, Job>
{
    /// <summary>Tạo Job mới (set company_id, trả về job_id IDENTITY).</summary>
    Task<long> InsertAsync(long companyId, Job job);

    /// <summary>Danh sách Job của công ty (Global Query Filter tự kèm company_id).</summary>
    Task<IEnumerable<Job>> GetListByCompanyAsync(long companyId);

    /// <summary>1 Job theo id (lọc theo company). Dùng để đọc department_manager_id ở bước offer.</summary>
    Task<Job?> GetByIdAsync(long companyId, long jobId);

    /// <summary>Lấy jd_text + cờ JD đã có embedding chưa (lọc theo company).</summary>
    Task<JobEmbeddingInfo?> GetEmbeddingInfoAsync(long companyId, long jobId);

    /// <summary>Sinh & lưu embedding cho JD (lazy embedding, chỉ chạy 1 lần/job).</summary>
    Task UpdateEmbeddingAsync(long companyId, long jobId, float[] embedding);

    /// <summary>
    /// Cập nhật Job. jdChanged=true -> NULL embedding cũ (JD đổi thì vector cũ vô nghĩa —
    /// quy tắc re-embedding; lần chấm sau tự embed lại). Trả số dòng (0 = không thấy).
    /// </summary>
    Task<int> UpdateAsync(long companyId, long jobId, string title, string? jdText,
        long? departmentManagerId, string status, bool jdChanged);

    /// <summary>API CÔNG KHAI: Lấy tất cả job đang tuyển (Status = 'Open').</summary>
    Task<IEnumerable<Job>> GetPublicOpenJobsAsync();

    /// <summary>API CÔNG KHAI: Lấy 1 job đang tuyển theo id.</summary>
    Task<Job?> GetPublicOpenJobAsync(long jobId);
}
