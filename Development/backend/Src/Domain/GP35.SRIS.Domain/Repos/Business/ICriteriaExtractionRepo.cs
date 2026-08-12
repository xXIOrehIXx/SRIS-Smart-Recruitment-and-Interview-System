using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Một lượt bóc worker vừa giành được — đủ để worker tự set tenant rồi chạy.</summary>
public record ClaimedExtraction(long ExtractionId, long CompanyId, long JobId);

/// <summary>
/// Hàng đợi bóc tiêu chí (V037). Một dòng / một job: xin bóc lại là ghi đè trạng thái cũ.
/// </summary>
public interface ICriteriaExtractionRepo : IBaseRepo<long, CriteriaExtraction>
{
    /// <summary>
    /// Xếp hàng một lượt bóc cho job (ghi đè lượt cũ nếu có). Trả về dòng vừa ghi.
    /// </summary>
    Task<CriteriaExtraction> EnqueueAsync(long companyId, long jobId, long requestedBy);

    /// <summary>Trạng thái lượt bóc gần nhất của job. Null = job này chưa bao giờ bóc.</summary>
    Task<CriteriaExtraction?> GetByJobAsync(long companyId, long jobId);

    /// <summary>
    /// Worker giành MỘT lượt PENDING và chuyển sang RUNNING trong cùng một câu lệnh
    /// (UPDATE ... OUTPUT) — hai worker chạy song song không thể nhận trùng một dòng.
    /// Null = hàng đợi rỗng. Chạy xuyên tenant nên gọi ngoài SESSION_CONTEXT.
    /// </summary>
    Task<ClaimedExtraction?> ClaimNextPendingAsync(CancellationToken ct = default);

    /// <summary>Đóng một lượt: DONE (kèm số tiêu chí) hoặc FAILED (kèm mã + câu báo người dùng).</summary>
    Task FinishAsync(long companyId, long extractionId, string status,
        int? criteriaCount, string? errorCode, string? errorMessage);

    /// <summary>
    /// Trả các lượt còn kẹt RUNNING về PENDING. Gọi lúc worker khởi động: app tắt giữa chừng
    /// thì dòng RUNNING không có ai đóng, để nguyên là lượt bóc đó treo vĩnh viễn.
    /// Trả số dòng đã thu hồi.
    /// </summary>
    Task<int> RequeueStaleRunningAsync(CancellationToken ct = default);
}
