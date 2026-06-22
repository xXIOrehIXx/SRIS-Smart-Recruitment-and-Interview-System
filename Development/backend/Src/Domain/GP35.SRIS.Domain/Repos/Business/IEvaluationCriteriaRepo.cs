using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Tiêu chí chấm phỏng vấn — PER-JOB, Recruiter tự định nghĩa (docs 5.7).</summary>
public interface IEvaluationCriteriaRepo : IBaseRepo<long, EvaluationCriteria>
{
    Task<long> InsertAsync(long companyId, EvaluationCriteria criteria);

    /// <summary>Tiêu chí của 1 job. activeOnly = chỉ tiêu chí đang bật.</summary>
    Task<IReadOnlyList<EvaluationCriteria>> GetByJobAsync(long companyId, long jobId, bool activeOnly);

    Task<EvaluationCriteria?> GetByIdAsync(long companyId, long criteriaId);

    /// <summary>Cập nhật nội dung/trọng số/bật-tắt 1 tiêu chí. Trả số dòng (0 = không thấy).</summary>
    Task<int> UpdateAsync(long companyId, long criteriaId, string name, decimal weight, decimal maxScore, bool active);
}
