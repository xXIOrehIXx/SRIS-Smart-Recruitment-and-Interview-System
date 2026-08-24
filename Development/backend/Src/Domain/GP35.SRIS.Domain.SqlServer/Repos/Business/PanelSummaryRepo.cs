using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class PanelSummaryRepo : BaseRepo<long, PanelSummary>, IPanelSummaryRepo
{
    private readonly SrisDbContext _db;

    public PanelSummaryRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<PanelSummary> EnqueueAsync(long companyId, long applicationId, long requestedBy)
    {
        var now = DateTime.UtcNow;

        // UNIQUE(application_id) -> bấm tổng hợp lại là ghi đè. Xoá KẾT QUẢ cũ ngay lúc xếp
        // hàng: để lại thì FE đang hỏi trạng thái vẽ bản cũ dưới chữ "đang tổng hợp", người
        // dùng tưởng đã xong (cùng bẫy đã gặp ở CvScreening).
        var existing = await _db.PanelSummaries.FirstOrDefaultAsync(e => e.ApplicationId == applicationId);
        if (existing is not null)
        {
            existing.Status = PanelSummaryStatus.Pending;
            existing.ErrorCode = null;
            existing.ErrorMessage = null;
            existing.Consensus = null;
            existing.AgreementsJson = null;
            existing.DisagreementsJson = null;
            existing.OpenQuestionsJson = null;
            existing.SourceVerdictCount = null;
            existing.RequestedBy = requestedBy;
            existing.RequestedAt = now;
            existing.StartedAt = null;
            existing.FinishedAt = null;
            existing.UpdatedAt = now;
            await _db.SaveChangesAsync();
            return existing;
        }

        var entity = new PanelSummary
        {
            CompanyId = companyId,
            ApplicationId = applicationId,
            Status = PanelSummaryStatus.Pending,
            RequestedBy = requestedBy,
            RequestedAt = now,
            CreatedAt = now
        };
        _db.PanelSummaries.Add(entity);
        await _db.SaveChangesAsync();
        return entity;
    }

    public async Task<PanelSummary?> GetByApplicationAsync(long companyId, long applicationId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.PanelSummaries
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.ApplicationId == applicationId);
    }

    public async Task<ClaimedPanelSummary?> ClaimNextPendingAsync(CancellationToken ct = default)
    {
        // Worker chạy ngoài request -> SESSION_CONTEXT('CompanyId') chưa set, RLS lọc sạch mọi
        // dòng. Tắt policy đúng lúc chạy câu giành việc rồi bật lại ngay (cùng cách CvScreeningRepo).
        // Chạy ngoài request -> tenant "hệ thống" (V049). KHÔNG tắt TenantSecurityPolicy:
        // DDL đó tắt RLS toàn database và các worker đua nhau bật/tắt nên giành hụt việc.
        return await _db.RunAsSystemAsync(async () =>
        {
            var rows = await _db.Database
                .SqlQueryRaw<ClaimedRow>(
                    "UPDATE TOP(1) s SET status = 'RUNNING', started_at = SYSUTCDATETIME(), " +
                    "       updated_at = SYSUTCDATETIME() " +
                    "OUTPUT inserted.summary_id AS SummaryId, " +
                    "       inserted.company_id AS CompanyId, " +
                    "       inserted.application_id AS ApplicationId " +
                    "FROM dbo.PanelSummary s WITH (READPAST) " +
                    "WHERE s.status = 'PENDING'")
                .ToListAsync(ct);

            var row = rows.FirstOrDefault();
            return row is null ? null : new ClaimedPanelSummary(row.SummaryId, row.CompanyId, row.ApplicationId);
        }, ct);
    }

    public async Task<int> FinishAsync(long companyId, long summaryId, string status,
        PanelSummaryOutcome? outcome, string? errorCode, string? errorMessage)
    {
        // Gọi trong scope đã set tenant -> Global Query Filter + RLS khớp, không cần tắt policy.
        return await _db.PanelSummaries
            .Where(e => e.SummaryId == summaryId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.Status, status)
                .SetProperty(e => e.Consensus, outcome == null ? null : outcome.Consensus)
                .SetProperty(e => e.AgreementsJson, outcome == null ? null : outcome.AgreementsJson)
                .SetProperty(e => e.DisagreementsJson, outcome == null ? null : outcome.DisagreementsJson)
                .SetProperty(e => e.OpenQuestionsJson, outcome == null ? null : outcome.OpenQuestionsJson)
                .SetProperty(e => e.SourceVerdictCount, outcome == null ? (int?)null : outcome.SourceVerdictCount)
                .SetProperty(e => e.ErrorCode, errorCode)
                .SetProperty(e => e.ErrorMessage, errorMessage)
                .SetProperty(e => e.FinishedAt, DateTime.UtcNow)
                .SetProperty(e => e.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<int> RequeueStaleRunningAsync(CancellationToken ct = default)
    {
        // Chạy ngoài request -> tenant "hệ thống" (V049). KHÔNG tắt TenantSecurityPolicy:
        // DDL đó tắt RLS toàn database và các worker đua nhau bật/tắt nên giành hụt việc.
        return await _db.RunAsSystemAsync(async () =>
        {
            return await _db.Database.ExecuteSqlRawAsync(
                "UPDATE dbo.PanelSummary " +
                "SET status = 'PENDING', started_at = NULL, updated_at = SYSUTCDATETIME() " +
                "WHERE status = 'RUNNING'", ct);
        }, ct);
    }

    /// <summary>Wrapper cho SqlQueryRaw — EF map theo tên property (giống ClaimedRow ở CvScreeningRepo).</summary>
    private class ClaimedRow
    {
        public long SummaryId { get; set; }
        public long CompanyId { get; set; }
        public long ApplicationId { get; set; }
    }
}
