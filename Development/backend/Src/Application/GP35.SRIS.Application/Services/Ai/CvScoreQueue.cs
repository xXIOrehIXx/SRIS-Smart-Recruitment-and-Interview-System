using System.Threading.Channels;
using GP35.SRIS.Application.Contracts.Services.Ai;

namespace GP35.SRIS.Application.Services.Ai;

/// <summary>
/// Cài đặt <see cref="ICvScoreQueue"/> bằng <see cref="Channel{T}"/> trong bộ nhớ (Cách A).
/// Đăng ký SINGLETON: luồng request (nhiều) ghi vào, worker nền (1) đọc ra.
/// Unbounded + <c>TryWrite</c> -> Enqueue không bao giờ chặn request nộp CV.
/// </summary>
public class CvScoreQueue : ICvScoreQueue
{
    private readonly Channel<CvScoreJob> _channel =
        Channel.CreateUnbounded<CvScoreJob>(new UnboundedChannelOptions { SingleReader = true });

    public void Enqueue(long companyId, long applicationId) =>
        _channel.Writer.TryWrite(new CvScoreJob(companyId, applicationId));

    public IAsyncEnumerable<CvScoreJob> DequeueAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}
