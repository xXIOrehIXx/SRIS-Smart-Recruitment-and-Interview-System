using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// Tiêu chí đánh giá — PER-JOB (docs 5.18). AI bóc ra DRAFT; người duyệt chốt APPROVED;
/// phiếu chấm phỏng vấn chỉ dùng APPROVED.
/// </summary>
public interface IEvaluationCriteriaRepo : IBaseRepo<long, EvaluationCriteria>
{
    Task<long> InsertAsync(long companyId, EvaluationCriteria criteria);

    /// <summary>
    /// Tiêu chí của 1 job. activeOnly = chỉ tiêu chí đang bật; approvedOnly = bỏ DRAFT
    /// (mặc định TRUE — chấm phỏng vấn/CV không được thấy tiêu chí chưa duyệt).
    /// </summary>
    Task<IReadOnlyList<EvaluationCriteria>> GetByJobAsync(
        long companyId, long jobId, bool activeOnly, bool approvedOnly = true);

    Task<EvaluationCriteria?> GetByIdAsync(long companyId, long criteriaId);

    /// <summary>Cập nhật 1 tiêu chí (gồm bật/tắt). Trả số dòng (0 = không thấy).</summary>
    Task<int> UpdateAsync(long companyId, long criteriaId, string name, decimal weight, decimal maxScore,
        bool active);

    /// <summary>Xóa tiêu chí DRAFT của job (trước khi AI bóc lại — tránh trùng lặp).</summary>
    Task<int> DeleteDraftsAsync(long companyId, long jobId);

    /// <summary>
    /// Xóa tiêu chí của job có tên nằm trong danh sách — dùng khi áp khuôn tiêu chí
    /// (đè toàn bộ record cũ cùng tên — cả DRAFT lẫn APPROVED, vì unique (job_id, name)).
    /// Trả số dòng đã xóa.
    /// </summary>
    Task<int> DeleteByJobAndNamesAsync(long companyId, long jobId, IReadOnlyCollection<string> names);

    /// <summary>Vô hiệu 1 tiêu chí (soft — active=0; giữ để không phá kết quả chấm đã lưu). Trả số dòng.</summary>
    Task<int> DeactivateAsync(long companyId, long criteriaId);

    /// <summary>Người duyệt chốt: DRAFT -> APPROVED, ghi ai duyệt lúc nào (audit 5.18).</summary>
    Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId);
}
