using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Một lượt sàng lọc worker vừa giành được — đủ để worker tự set tenant rồi chạy.</summary>
public record ClaimedScreening(long ScreeningId, long CompanyId, long ApplicationId);

/// <summary>Kết quả AI trả về, đã tuần tự hoá sẵn để ghi thẳng xuống DB.</summary>
public record ScreeningOutcome(
    string Summary, string MatchedJson, string MissingJson,
    int FitScore, string Decision, string DecisionReason);

/// <summary>
/// Hàng đợi + kết quả sàng lọc CV (V044). Một dòng / một hồ sơ: xin phân tích lại là ghi đè.
/// Cùng hình dạng với <see cref="ICriteriaExtractionRepo"/> vì cùng kiểu worker chạy nền.
/// </summary>
public interface ICvScreeningRepo : IBaseRepo<long, CvScreening>
{
    /// <summary>
    /// Xếp hàng một lượt sàng lọc cho hồ sơ (ghi đè lượt cũ nếu có). Trả về dòng vừa ghi.
    /// </summary>
    Task<CvScreening> EnqueueAsync(long companyId, long applicationId, long jobId, long cvId, long requestedBy);

    /// <summary>Lượt sàng lọc gần nhất của hồ sơ. Null = hồ sơ này chưa bao giờ phân tích.</summary>
    Task<CvScreening?> GetByApplicationAsync(long companyId, long applicationId);

    /// <summary>
    /// Worker giành MỘT lượt PENDING và chuyển sang RUNNING trong cùng một câu lệnh
    /// (UPDATE ... OUTPUT) — hai worker chạy song song không thể nhận trùng một dòng.
    /// Null = hàng đợi rỗng. Chạy xuyên tenant nên gọi ngoài SESSION_CONTEXT.
    /// </summary>
    Task<ClaimedScreening?> ClaimNextPendingAsync(CancellationToken ct = default);

    /// <summary>
    /// Đóng một lượt: DONE (kèm kết quả) hoặc FAILED (kèm mã + câu báo người dùng).
    /// Trả SỐ DÒNG đã đổi — 0 nghĩa là không đóng được (sai tenant, dòng bị xoá) và dòng đó
    /// còn treo RUNNING; caller phải kêu lên chứ không được coi như đã đóng.
    /// </summary>
    Task<int> FinishAsync(long companyId, long screeningId, string status,
        ScreeningOutcome? outcome, string? errorCode, string? errorMessage);

    /// <summary>
    /// Trả các lượt còn kẹt RUNNING về PENDING. Gọi lúc worker khởi động: app tắt giữa chừng
    /// thì dòng RUNNING không có ai đóng, để nguyên là lượt sàng lọc đó treo vĩnh viễn.
    /// Trả số dòng đã thu hồi.
    /// </summary>
    Task<int> RequeueStaleRunningAsync(CancellationToken ct = default);
}
