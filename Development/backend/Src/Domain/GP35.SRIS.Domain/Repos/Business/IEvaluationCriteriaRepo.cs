using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Đoạn CV khớp nhất với 1 tiêu chí SOFT (Distance nhỏ = khớp nhiều).</summary>
public record SoftCriterionMatch(long CriteriaId, double Distance, string Content);

/// <summary>
/// Tiêu chí đánh giá — PER-JOB, trục xuyên suốt từ lọc CV đến phỏng vấn (docs 5.18).
/// AI bóc ra DRAFT; người duyệt APPROVED; chấm CV/phỏng vấn chỉ dùng APPROVED.
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

    /// <summary>Cập nhật 1 tiêu chí (gồm phân loại HARD/SOFT + keywords). Trả số dòng (0 = không thấy).</summary>
    Task<int> UpdateAsync(long companyId, long criteriaId, string name, decimal weight, decimal maxScore,
        bool active, string criteriaType, bool cvMatchable, string? keywords);

    /// <summary>Xóa tiêu chí DRAFT của job (trước khi AI bóc lại — tránh trùng lặp).</summary>
    Task<int> DeleteDraftsAsync(long companyId, long jobId);

    /// <summary>Người duyệt chốt: DRAFT -> APPROVED, ghi ai duyệt lúc nào (audit 5.18).</summary>
    Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId);

    /// <summary>Id các tiêu chí SOFT đã duyệt còn thiếu embedding (lazy — như JD).</summary>
    Task<IReadOnlyList<long>> GetSoftCriteriaNeedingEmbeddingAsync(long companyId, long jobId);

    /// <summary>Sinh & lưu embedding cho 1 tiêu chí (cột VECTOR — raw SQL 5.11).</summary>
    Task UpdateEmbeddingAsync(long companyId, long criteriaId, float[] embedding);

    /// <summary>
    /// Mỗi tiêu chí SOFT (đã duyệt, đang bật, cv_matchable) đi tìm đoạn CV khớp nhất —
    /// VECTOR_DISTANCE đo trong SQL Server (docs 5.18: "mỗi tiêu chí đi tìm đoạn CV khớp nhất").
    /// </summary>
    Task<IReadOnlyList<SoftCriterionMatch>> GetBestChunkPerSoftCriterionAsync(
        long companyId, long jobId, long cvId);
}
