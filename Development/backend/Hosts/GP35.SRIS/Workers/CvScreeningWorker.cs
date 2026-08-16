using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using ILogger = Serilog.ILogger;

namespace GP35.SRIS.Workers;

/// <summary>
/// Worker chạy hàng đợi sàng lọc CV (V044) — cùng khuôn với <see cref="CriteriaExtractionWorker"/>.
///
/// <para>
/// Vì sao có worker này: một lượt sàng lọc bắt Local LLM đọc cả CV lẫn tin tuyển dụng, trên CPU
/// mất hàng chục giây tới vài phút. Để đồng bộ thì trình duyệt bỏ cuộc (axios timeout 30s) trong
/// khi backend vẫn chạy — người dùng thấy "lỗi mạng" dù AI vẫn đang làm việc.
/// </para>
///
/// Chạy TUẦN TỰ một lượt một, và cố ý KHÔNG gộp chung với worker bóc tiêu chí: Ollama trên máy
/// demo chỉ giữ được ít model trong RAM, mà hai việc dùng hai model khác nhau. Xen kẽ hai loại
/// việc trong một vòng lặp là bắt Ollama nạp/đuổi model liên tục — mỗi lần vài giây chỉ để đổi
/// model. Hai worker riêng thì mỗi hàng đợi chạy hết một mạch với đúng một model.
/// </summary>
public sealed class CvScreeningWorker : BackgroundService
{
    /// <summary>Hàng đợi rỗng thì nghỉ 5s — đủ nhanh để người bấm không thấy độ trễ đáng kể.</summary>
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(5);

    /// <summary>Lỗi lạ (mất DB...) thì lùi lâu hơn, tránh quay vòng đốt log.</summary>
    private static readonly TimeSpan ErrorDelay = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger _logger;

    public CvScreeningWorker(IServiceScopeFactory scopeFactory, ILogger logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger.ForContext<CvScreeningWorker>();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Đợi app + migration ổn định trước khi đụng bảng hàng đợi.
        try { await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken); }
        catch (OperationCanceledException) { return; }

        await RequeueStaleAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            bool didWork;
            try
            {
                didWork = await ProcessOneAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                _logger.Error(ex, "CvScreeningWorker: lỗi không mong đợi khi lấy việc.");
                didWork = false;
                try { await Task.Delay(ErrorDelay, stoppingToken); }
                catch (OperationCanceledException) { return; }
            }

            // Còn việc thì làm tiếp ngay, không ngủ — hàng đợi dài sẽ chạy hết trong một mạch.
            if (didWork) continue;

            try { await Task.Delay(IdleDelay, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>
    /// App tắt giữa lúc đang sàng lọc thì dòng đó kẹt RUNNING và không ai đóng — lượt phân tích
    /// treo vĩnh viễn dưới mắt người dùng. Khởi động lại là thu hồi về PENDING để chạy lại.
    /// </summary>
    private async Task RequeueStaleAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<ICvScreeningRepo>();
            var n = await repo.RequeueStaleRunningAsync(ct);
            if (n > 0)
                _logger.Information("CvScreeningWorker: thu hồi {N} lượt sàng lọc kẹt RUNNING -> PENDING.", n);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "CvScreeningWorker: thu hồi lượt kẹt thất bại — bỏ qua, chạy tiếp.");
        }
    }

    /// <summary>Xử lý tối đa 1 lượt. Trả true nếu có việc để làm.</summary>
    private async Task<bool> ProcessOneAsync(CancellationToken ct)
    {
        // Bước 1: giành việc trong scope "trung tính" — worker cần nhìn xuyên tenant.
        ClaimedScreening? claimed;
        using (var scope = _scopeFactory.CreateScope())
        {
            var repo = scope.ServiceProvider.GetRequiredService<ICvScreeningRepo>();
            claimed = await repo.ClaimNextPendingAsync(ct);
        }

        if (claimed is null) return false;

        // Bước 2: scope riêng đã set tenant -> RLS + Global Query Filter khớp đúng công ty.
        using (var scope = _scopeFactory.CreateScope())
        {
            // Set tenant TRƯỚC khi resolve service: service kéo theo repo, repo kéo theo
            // SrisDbContext. Đặt sau là để DbContext sinh ra khi tenant còn là 0.
            var ctx = scope.ServiceProvider.GetRequiredService<IContextData>();
            ctx.CompanyId = claimed.CompanyId;

            var service = scope.ServiceProvider.GetRequiredService<ICvScreeningService>();

            _logger.Information("CvScreeningWorker: bắt đầu sàng lọc hồ sơ {AppId} (company={Co}).",
                claimed.ApplicationId, claimed.CompanyId);

            // RunScreeningAsync tự nuốt mọi lỗi và tự đóng dòng DONE/FAILED — worker không cần
            // try/catch quanh nó, và quan trọng hơn: không có đường nào để dòng kẹt RUNNING.
            await service.RunScreeningAsync(claimed.CompanyId, claimed.ApplicationId, claimed.ScreeningId, ct);
        }

        return true;
    }
}
