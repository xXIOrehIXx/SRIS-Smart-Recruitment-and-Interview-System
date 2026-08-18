using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Một lượt tổng hợp worker vừa giành được — đủ để worker tự set tenant rồi chạy.</summary>
public record ClaimedPanelSummary(long SummaryId, long CompanyId, long ApplicationId);

/// <summary>Kết quả AI trả về, đã tuần tự hoá sẵn để ghi thẳng xuống DB.</summary>
public record PanelSummaryOutcome(
    string Consensus, string AgreementsJson, string DisagreementsJson,
    string OpenQuestionsJson, int SourceVerdictCount);

/// <summary>
/// Hàng đợi + kết quả tổng hợp ý kiến hội đồng phỏng vấn (V047). Một dòng / một hồ sơ:
/// xin tổng hợp lại là ghi đè. Cùng hình dạng <see cref="ICvScreeningRepo"/> — cùng kiểu worker.
/// </summary>
public interface IPanelSummaryRepo : IBaseRepo<long, PanelSummary>
{
    /// <summary>Xếp hàng một lượt tổng hợp cho hồ sơ (ghi đè lượt cũ nếu có). Trả dòng vừa ghi.</summary>
    Task<PanelSummary> EnqueueAsync(long companyId, long applicationId, long requestedBy);

    /// <summary>Bản tổng hợp gần nhất của hồ sơ. Null = chưa bao giờ tổng hợp.</summary>
    Task<PanelSummary?> GetByApplicationAsync(long companyId, long applicationId);

    /// <summary>
    /// Worker giành MỘT lượt PENDING và chuyển sang RUNNING trong cùng một câu lệnh
    /// (UPDATE ... OUTPUT). Null = hàng đợi rỗng. Chạy xuyên tenant nên gọi ngoài SESSION_CONTEXT.
    /// </summary>
    Task<ClaimedPanelSummary?> ClaimNextPendingAsync(CancellationToken ct = default);

    /// <summary>
    /// Đóng một lượt: DONE (kèm kết quả) hoặc FAILED (kèm mã + câu báo người dùng).
    /// Trả SỐ DÒNG đã đổi — 0 nghĩa là dòng còn treo RUNNING và caller phải kêu lên.
    /// </summary>
    Task<int> FinishAsync(long companyId, long summaryId, string status,
        PanelSummaryOutcome? outcome, string? errorCode, string? errorMessage);

    /// <summary>Trả các lượt kẹt RUNNING về PENDING (gọi lúc worker khởi động). Trả số dòng.</summary>
    Task<int> RequeueStaleRunningAsync(CancellationToken ct = default);
}
