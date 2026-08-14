using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using ILogger = Serilog.ILogger;

namespace GP35.SRIS.Workers;

/// <summary>
/// Worker quét job quá hạn mỗi 5 phút, tự chuyển <c>Status</c> sang <c>Closed</c> để job không
/// còn xuất hiện ở trang công khai và trong list Open của Human Resource (giữ lại row trong DB để
/// không mất hồ sơ ứng viên + analytics).
///
/// Vòng lặp:
///   1. Raw SQL liệt kê job Open, deadline &lt; hôm nay UTC, GROUP theo company.
///   2. Với mỗi entry: tạo scope, set <see cref="IContextData.CompanyId"/>, gọi
///      <c>JobRepo.UpdateAsync</c> để close.
///
/// Lưu ý RLS: query list dùng raw SQL (không có SESSION_CONTEXT) — chỉ đọc metadata
/// (company_id, job_id, title, deadline); UPDATE đi qua JobRepo.UpdateAsync nên vẫn
/// chạy đúng RLS filter theo tenant.
/// </summary>
public sealed class JobExpiryWorker : BackgroundService
{
    /// <summary>5 phút — đủ nhỏ để job quá hạn không nằm quá 5' ở trạng thái Open.</summary>
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger _logger;

    public JobExpiryWorker(IServiceScopeFactory scopeFactory, ILogger logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger.ForContext<JobExpiryWorker>();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Đợi 30s đầu cho app + migration ổn định trước khi quét lần đầu.
        try { await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                // Lỗi không xác định — log rồi vòng lặp tiếp tục, KHÔNG chết worker.
                _logger.Error(ex, "JobExpiryWorker: lỗi không mong đợi trong vòng quét.");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        // Bước 1: đọc danh sách (dùng scope "trung tính" — không set CompanyId vì worker cần
        // nhìn xuyên tenant). Scope tạm thời nhưng cần DbContext nên dùng scope factory riêng.
        List<ExpiredJobRef> all;
        using (var scope = _scopeFactory.CreateScope())
        {
            var jobRepo = scope.ServiceProvider.GetRequiredService<IJobRepo>();
            all = (await jobRepo.GetExpiredOpenJobsAsync(ct)).ToList();
        }

        if (all.Count == 0) return;

        _logger.Information("JobExpiryWorker: phát hiện {Count} job Open quá hạn — bắt đầu đóng.", all.Count);

        // Bước 2: từng entry — set tenant rồi đóng.
        var closed = 0;
        foreach (var item in all)
        {
            if (ct.IsCancellationRequested) break;
            try
            {
                await CloseOneAsync(item, ct);
                closed++;
            }
            catch (Exception ex)
            {
                _logger.Warning(ex,
                    "JobExpiryWorker: đóng job {JobId} (company={Co}) thất bại — bỏ qua.",
                    item.JobId, item.CompanyId);
            }
        }

        if (closed > 0)
        {
            _logger.Information("JobExpiryWorker: đã chuyển {Closed}/{Total} job sang 'Closed' (quá hạn).",
                closed, all.Count);
        }
    }

    private async Task CloseOneAsync(ExpiredJobRef item, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        // Đặt tenant TRƯỚC KHI RESOLVE repo (không chỉ trước khi gọi): resolve repo là tạo luôn
        // SrisDbContext, và Global Query Filter đọc tenant từ IContextData — dựng nó lúc tenant
        // còn 0 thì mọi query lọc company_id = 0, GetById trả null và job không bao giờ đóng.
        var ctx = scope.ServiceProvider.GetRequiredService<IContextData>();
        ctx.CompanyId = item.CompanyId;

        var jobRepo = scope.ServiceProvider.GetRequiredService<IJobRepo>();

        var job = await jobRepo.GetByIdAsync(item.CompanyId, item.JobId);
        if (job is null) return;
        if (!string.Equals(job.Status, "Open", StringComparison.OrdinalIgnoreCase))
        {
            // Ai đó vừa đóng job giữa lúc query list và xử lý close — bỏ qua, idempotent.
            return;
        }

        await jobRepo.UpdateAsync(
            item.CompanyId, item.JobId, job.Title, job.JdText,
            job.DepartmentManagerId, "Closed");

        _logger.Information(
            "JobExpiryWorker: job {JobId} '{Title}' (company={Co}) đã quá hạn {Deadline:dd/MM/yyyy} — Closed.",
            item.JobId, item.Title, item.CompanyId, item.Deadline);
    }
}
