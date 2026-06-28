namespace GP35.SRIS.Application.Contracts.Services.Ai;

/// <summary>1 việc chấm điểm nền: hồ sơ <paramref name="ApplicationId"/> của công ty <paramref name="CompanyId"/>.</summary>
public readonly record struct CvScoreJob(long CompanyId, long ApplicationId);

/// <summary>
/// Hàng đợi chấm điểm CV chạy NGẦM (Cách A — fire-and-forget).
/// Luồng nộp CV chỉ lưu hồ sơ (state NEW, chưa có điểm) rồi <see cref="Enqueue"/> applicationId rồi trả về NGAY;
/// một worker nền (<c>CvScoringWorker</c>) rút ra chấm sau — KHÔNG bắt ứng viên đứng đợi gọi AI.
/// </summary>
public interface ICvScoreQueue
{
    /// <summary>Đẩy 1 hồ sơ vào hàng đợi chấm nền. KHÔNG bao giờ chặn luồng gọi (hàng đợi không giới hạn).</summary>
    void Enqueue(long companyId, long applicationId);

    /// <summary>Worker nền đọc lần lượt các hồ sơ chờ chấm cho tới khi <paramref name="cancellationToken"/> hủy.</summary>
    IAsyncEnumerable<CvScoreJob> DequeueAllAsync(CancellationToken cancellationToken);
}
