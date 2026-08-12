using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using ILogger = Serilog.ILogger;

namespace GP35.SRIS.Workers;

/// <summary>
/// Worker chạy hàng đợi bóc tiêu chí (V037).
///
/// <para>
/// Vì sao có worker này: bóc tiêu chí gọi Local LLM chạy trên CPU, một JD thật mất hàng chục
/// giây. Để đồng bộ thì trình duyệt bỏ cuộc (axios timeout 30s) trong khi backend vẫn chạy —
/// người dùng thấy "lỗi mạng" dù AI vẫn đang làm việc. Giờ Human Resource bấm xong đi làm việc
/// khác, quay lại xem kết quả.
/// </para>
///
/// Vòng lặp:
///   1. Giành MỘT lượt PENDING (UPDATE ... OUTPUT — nguyên tử, không nhận trùng).
///   2. Tạo scope, set <see cref="IContextData.CompanyId"/> rồi gọi service chạy thật.
///   3. Còn việc thì làm tiếp ngay, hết việc mới ngủ.
///
/// Chạy TUẦN TỰ một lượt một: Ollama trên máy demo chỉ có một model nạp trong RAM, bắn song
/// song vào nó chỉ làm mọi lượt cùng chậm đi chứ không nhanh hơn.
/// </summary>
public sealed class CriteriaExtractionWorker : BackgroundService
{
    /// <summary>Hàng đợi rỗng thì nghỉ 5s — đủ nhanh để người bấm không thấy độ trễ đáng kể.</summary>
    private static readonly TimeSpan IdleDelay = TimeSpan.FromSeconds(5);

    /// <summary>Lỗi lạ (mất DB...) thì lùi lâu hơn, tránh quay vòng đốt log.</summary>
    private static readonly TimeSpan ErrorDelay = TimeSpan.FromSeconds(30);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger _logger;

    public CriteriaExtractionWorker(IServiceScopeFactory scopeFactory, ILogger logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger.ForContext<CriteriaExtractionWorker>();
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
                _logger.Error(ex, "CriteriaExtractionWorker: lỗi không mong đợi khi lấy việc.");
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
    /// App tắt giữa lúc đang bóc thì dòng đó kẹt RUNNING và không ai đóng — lượt bóc treo
    /// vĩnh viễn dưới mắt người dùng. Khởi động lại là thu hồi về PENDING để chạy lại.
    /// </summary>
    private async Task RequeueStaleAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<ICriteriaExtractionRepo>();
            var n = await repo.RequeueStaleRunningAsync(ct);
            if (n > 0)
                _logger.Information("CriteriaExtractionWorker: thu hồi {N} lượt bóc kẹt RUNNING -> PENDING.", n);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "CriteriaExtractionWorker: thu hồi lượt kẹt thất bại — bỏ qua, chạy tiếp.");
        }
    }

    /// <summary>Xử lý tối đa 1 lượt. Trả true nếu có việc để làm.</summary>
    private async Task<bool> ProcessOneAsync(CancellationToken ct)
    {
        // Bước 1: giành việc trong scope "trung tính" — worker cần nhìn xuyên tenant.
        ClaimedExtraction? claimed;
        using (var scope = _scopeFactory.CreateScope())
        {
            var repo = scope.ServiceProvider.GetRequiredService<ICriteriaExtractionRepo>();
            claimed = await repo.ClaimNextPendingAsync(ct);
        }

        if (claimed is null) return false;

        // Bước 2: scope riêng đã set tenant -> RLS + Global Query Filter khớp đúng công ty.
        using (var scope = _scopeFactory.CreateScope())
        {
            var ctx = scope.ServiceProvider.GetRequiredService<IContextData>();
            var service = scope.ServiceProvider.GetRequiredService<IEvaluationCriteriaService>();

            ctx.CompanyId = claimed.CompanyId;

            _logger.Information("CriteriaExtractionWorker: bắt đầu bóc job {JobId} (company={Co}).",
                claimed.JobId, claimed.CompanyId);

            // RunExtractionAsync tự nuốt mọi lỗi và tự đóng dòng DONE/FAILED — worker không
            // cần try/catch quanh nó, và quan trọng hơn: không có đường nào để dòng kẹt RUNNING.
            await service.RunExtractionAsync(claimed.CompanyId, claimed.JobId, claimed.ExtractionId, ct);
        }

        return true;
    }
}
