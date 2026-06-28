using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using ILogger = Serilog.ILogger;

namespace GP35.SRIS.Workers;

/// <summary>
/// Worker chấm điểm CV chạy NGẦM (Cách A — fire-and-forget). 1 worker (đọc tuần tự) khớp với việc
/// AI embed nối đuôi nhau, nên không gây "thundering herd" lên AI service.
///
/// - Khởi động: quét MỌI hồ sơ chưa chấm (vớt phần còn sót nếu server từng restart giữa chừng).
/// - Vòng lặp: rút từng hồ sơ trong hàng đợi -> tạo DI scope mới -> gán tenant (companyId) -> chấm.
///
/// Lưu ý tenant/RLS: scope nền KHÔNG có request nên phải tự set <see cref="IContextData.CompanyId"/>
/// TRƯỚC khi resolve service/DbContext (Global Query Filter + interceptor SESSION_CONTEXT đọc từ đó).
/// </summary>
public sealed class CvScoringWorker : BackgroundService
{
    private readonly ICvScoreQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger _logger;

    public CvScoringWorker(ICvScoreQueue queue, IServiceScopeFactory scopeFactory, ILogger logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger.ForContext<CvScoringWorker>();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await SweepUnscoredAsync(stoppingToken);

        await foreach (var job in _queue.DequeueAllAsync(stoppingToken))
        {
            try
            {
                await ScoreOneAsync(job, stoppingToken);
            }
            catch (Exception ex)
            {
                // Lỗi 1 hồ sơ (vd AI service chết) KHÔNG được làm chết worker -> log rồi đi tiếp.
                // Hồ sơ vẫn ở điểm NULL -> lần khởi động sau sweep sẽ vớt lại.
                _logger.Warning(ex,
                    "CvScoringWorker: chấm hồ sơ app={AppId} (company={Co}) thất bại — để điểm NULL, vớt lại sau.",
                    job.ApplicationId, job.CompanyId);
            }
        }
    }

    private async Task ScoreOneAsync(CvScoreJob job, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var sp = scope.ServiceProvider;

        // Gán tenant cho scope nền TRƯỚC khi resolve service (DbContext đọc CompanyId lúc khởi tạo).
        sp.GetRequiredService<IContextData>().CompanyId = job.CompanyId;

        var scoring = sp.GetRequiredService<ICvScoringService>();
        await scoring.ScoreApplicationAsync(job.CompanyId, job.ApplicationId);
    }

    private async Task SweepUnscoredAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var appRepo = scope.ServiceProvider.GetRequiredService<IApplicationRepo>();
            var pending = await appRepo.GetAllUnscoredAsync();

            if (pending.Count == 0) return;

            _logger.Information("CvScoringWorker: vớt {N} hồ sơ chưa chấm lúc khởi động.", pending.Count);
            foreach (var p in pending)
                _queue.Enqueue(p.CompanyId, p.ApplicationId);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "CvScoringWorker: quét hồ sơ chưa chấm lúc khởi động thất bại — bỏ qua.");
        }
    }
}
