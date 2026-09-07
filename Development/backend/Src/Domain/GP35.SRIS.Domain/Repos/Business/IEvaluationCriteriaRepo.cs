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

    /// <summary>Gửi duyệt (V055): DRAFT -> PENDING, xoá ghi chú trả về của lượt trước.</summary>
    Task<int> SubmitDraftsAsync(long companyId, long jobId, long userId);

    /// <summary>
    /// Trưởng bộ phận chốt (V055): PENDING -> APPROVED, ghi ai duyệt lúc nào (audit 5.18).
    /// Chỉ nhận PENDING — DRAFT chưa gửi thì không có gì để duyệt.
    /// </summary>
    Task<int> ApprovePendingAsync(long companyId, long jobId, long userId);

    /// <summary>Trưởng bộ phận trả về (V055): PENDING -> DRAFT kèm lý do, để nhân sự sửa rồi gửi lại.</summary>
    Task<int> RequestChangesAsync(long companyId, long jobId, long userId, string note);

    /// <summary>Ghi chú trả về gần nhất của bộ tiêu chí (dòng có reviewed_at mới nhất). Null nếu chưa từng bị trả.</summary>
    Task<EvaluationCriteria?> GetLatestReviewedAsync(long companyId, long jobId);

    // ---- V056: bộ tiêu chí còn nằm ở YÊU CẦU TUYỂN DỤNG (job chưa tồn tại) ----

    /// <summary>Tiêu chí của một yêu cầu tuyển dụng. Xem <see cref="GetByJobAsync"/> cho ý nghĩa hai cờ.</summary>
    Task<IReadOnlyList<EvaluationCriteria>> GetByRequestAsync(
        long companyId, long requestId, bool activeOnly, bool approvedOnly = true);

    /// <summary>Xoá tiêu chí DRAFT của yêu cầu (trước khi AI bóc lại — tránh trùng lặp).</summary>
    Task<int> DeleteDraftsByRequestAsync(long companyId, long requestId);

    /// <summary>
    /// Trưởng bộ phận chốt bộ tiêu chí NGAY TRÊN yêu cầu: DRAFT -> APPROVED (V056).
    /// KHÔNG đi qua PENDING — ở đường này người ra đề cũng chính là người duyệt, xem
    /// <c>JobCriteriaAccessGuard.EnsureCanEditRequestCriteriaAsync</c>.
    /// </summary>
    Task<int> ApproveForRequestAsync(long companyId, long requestId, long userId);

    /// <summary>
    /// CHUYỂN bộ tiêu chí đã duyệt của yêu cầu sang job vừa tạo (V056): điền job_id, GIỮ
    /// request_id làm dấu vết nguồn. Chỉ chuyển dòng chưa có job_id — gọi hai lần không nhân đôi.
    /// Trả số dòng đã chuyển.
    /// </summary>
    Task<int> MoveToJobAsync(long companyId, long requestId, long jobId);
}
