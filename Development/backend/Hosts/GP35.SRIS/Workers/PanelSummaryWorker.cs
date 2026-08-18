using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using ILogger = Serilog.ILogger;

namespace GP35.SRIS.Workers;

/// <summary>
/// Worker chạy hàng đợi tổng hợp ý kiến hội đồng phỏng vấn (V047) — cùng khuôn với
/// <see cref="CvScreeningWorker"/>.
///
/// <para>
/// Vì sao có worker này: dù đầu vào chỉ là vài đoạn nhận xét, Local LLM trên CPU vẫn mất hàng
/// chục giây. Gọi đồng bộ thì trình duyệt bỏ cuộc (axios timeout 30s) trong khi backend vẫn
/// chạy — người dùng thấy "lỗi mạng" dù AI vẫn đang làm việc.
/// </para>
///
/// Chạy TUẦN TỰ một lượt một, và tách riêng khỏi hai worker kia đúng theo luật cũ: mỗi hàng đợi
/// chạy hết một mạch với đúng một model, không bắt Ollama nạp/đuổi model giữa chừng.
/// Việc này dùng chung model với lượt bóc tiêu chí (SRIS_PANEL_MODEL mặc định = SRIS_LLM_MODEL)
/// nên hai hàng đợi đó không đá nhau.
/// </summary>
public sealed class PanelSummaryWorker : BackgroundService
{
    /// <summary>Hàng đợi rỗng thì nghỉ 5s — đủ nhanh để người bấm không thấy độ trễ đáng kể.</summary>
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(5);

    /// <summary>Lỗi lạ (mất DB...) thì lùi lâu hơn, tránh quay vòng đốt log.</summary>
    private static readonly TimeSpan ErrorDelay = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger _logger;

    public PanelSummaryWorker(IServiceScopeFactory scopeFactory, ILogger logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger.ForContext<PanelSummaryWorker>();
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
                _logger.Error(ex, "PanelSummaryWorker: lỗi không mong đợi khi lấy việc.");
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
    /// App tắt giữa lúc đang tổng hợp thì dòng đó kẹt RUNNING và không ai đóng — lượt tổng hợp
    /// treo vĩnh viễn dưới mắt người dùng. Khởi động lại là thu hồi về PENDING để chạy lại.
    /// </summary>
    private async Task RequeueStaleAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IPanelSummaryRepo>();
            var n = await repo.RequeueStaleRunningAsync(ct);
            if (n > 0)
                _logger.Information("PanelSummaryWorker: thu hồi {N} lượt tổng hợp kẹt RUNNING -> PENDING.", n);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "PanelSummaryWorker: thu hồi lượt kẹt thất bại — bỏ qua, chạy tiếp.");
        }
    }

    /// <summary>Xử lý tối đa 1 lượt. Trả true nếu có việc để làm.</summary>
    private async Task<bool> ProcessOneAsync(CancellationToken ct)
    {
        // Bước 1: giành việc trong scope "trung tính" — worker cần nhìn xuyên tenant.
        ClaimedPanelSummary? claimed;
        using (var scope = _scopeFactory.CreateScope())
        {
            var repo = scope.ServiceProvider.GetRequiredService<IPanelSummaryRepo>();
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

            var service = scope.ServiceProvider.GetRequiredService<IPanelSummaryService>();

            _logger.Information("PanelSummaryWorker: bắt đầu tổng hợp ý kiến hồ sơ {AppId} (company={Co}).",
                claimed.ApplicationId, claimed.CompanyId);

            // RunSummaryAsync tự nuốt mọi lỗi và tự đóng dòng DONE/FAILED — worker không cần
            // try/catch quanh nó, và quan trọng hơn: không có đường nào để dòng kẹt RUNNING.
            await service.RunSummaryAsync(claimed.CompanyId, claimed.ApplicationId, claimed.SummaryId, ct);
        }

        return true;
    }
}
