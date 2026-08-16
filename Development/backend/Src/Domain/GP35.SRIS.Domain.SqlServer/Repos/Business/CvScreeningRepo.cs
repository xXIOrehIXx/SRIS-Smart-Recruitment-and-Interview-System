using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CvScreeningRepo : BaseRepo<long, CvScreening>, ICvScreeningRepo
{
    private readonly SrisDbContext _db;

    public CvScreeningRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<CvScreening> EnqueueAsync(
        long companyId, long applicationId, long jobId, long cvId, long requestedBy)
    {
        var now = DateTime.UtcNow;

        // UNIQUE(application_id) -> bấm phân tích lại là ghi đè lượt cũ, không xếp hàng chồng.
        // Xoá sạch KẾT QUẢ lượt trước ngay lúc xếp hàng: để lại thì FE đang hỏi trạng thái sẽ
        // vẽ kết quả cũ bên dưới chữ "đang phân tích", người dùng tưởng đã xong.
        var existing = await _db.CvScreenings.FirstOrDefaultAsync(e => e.ApplicationId == applicationId);
        if (existing is not null)
        {
            existing.JobId = jobId;
            // CV có thể đã được nộp lại sau lượt trước -> bám theo cv_id mới nhất của hồ sơ.
            existing.CvId = cvId;
            existing.Status = ScreeningStatus.Pending;
            existing.ErrorCode = null;
            existing.ErrorMessage = null;
            existing.Summary = null;
            existing.MatchedJson = null;
            existing.MissingJson = null;
            existing.FitScore = null;
            existing.Decision = null;
            existing.DecisionReason = null;
            existing.RequestedBy = requestedBy;
            existing.RequestedAt = now;
            existing.StartedAt = null;
            existing.FinishedAt = null;
            existing.UpdatedAt = now;
            await _db.SaveChangesAsync();
            return existing;
        }

        var entity = new CvScreening
        {
            CompanyId = companyId,
            ApplicationId = applicationId,
            JobId = jobId,
            CvId = cvId,
            Status = ScreeningStatus.Pending,
            RequestedBy = requestedBy,
            RequestedAt = now,
            CreatedAt = now
        };
        _db.CvScreenings.Add(entity);
        await _db.SaveChangesAsync();
        return entity;
    }

    public async Task<CvScreening?> GetByApplicationAsync(long companyId, long applicationId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.CvScreenings
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.ApplicationId == applicationId);
    }

    public async Task<ClaimedScreening?> ClaimNextPendingAsync(CancellationToken ct = default)
    {
        // Worker không chạy trong request nào nên SESSION_CONTEXT('CompanyId') chưa set ->
        // RLS lọc sạch mọi dòng. Tắt policy đúng trong lúc chạy câu lệnh giành việc (cùng
        // cách CriteriaExtractionRepo làm), rồi bật lại ngay.
        //
        // UPDATE ... OUTPUT là MỘT câu lệnh: giành + đánh dấu RUNNING xảy ra nguyên tử, hai
        // worker song song không thể cùng nhận một dòng. READPAST bỏ qua dòng đang bị khoá
        // thay vì xếp hàng đợi nó.
        await _db.Database.ExecuteSqlRawAsync(
            "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = OFF);", ct);
        try
        {
            var rows = await _db.Database
                .SqlQueryRaw<ClaimedRow>(
                    "UPDATE TOP(1) s SET status = 'RUNNING', started_at = SYSUTCDATETIME(), " +
                    "       updated_at = SYSUTCDATETIME() " +
                    "OUTPUT inserted.screening_id AS ScreeningId, " +
                    "       inserted.company_id AS CompanyId, " +
                    "       inserted.application_id AS ApplicationId " +
                    "FROM dbo.CvScreening s WITH (READPAST) " +
                    "WHERE s.status = 'PENDING'")
                .ToListAsync(ct);

            var row = rows.FirstOrDefault();
            return row is null ? null : new ClaimedScreening(row.ScreeningId, row.CompanyId, row.ApplicationId);
        }
        finally
        {
            await _db.Database.ExecuteSqlRawAsync(
                "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = ON);", CancellationToken.None);
        }
    }

    public async Task<int> FinishAsync(long companyId, long screeningId, string status,
        ScreeningOutcome? outcome, string? errorCode, string? errorMessage)
    {
        // Gọi trong scope đã set tenant -> Global Query Filter + RLS khớp, không cần tắt policy.
        return await _db.CvScreenings
            .Where(e => e.ScreeningId == screeningId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.Status, status)
                .SetProperty(e => e.Summary, outcome == null ? null : outcome.Summary)
                .SetProperty(e => e.MatchedJson, outcome == null ? null : outcome.MatchedJson)
                .SetProperty(e => e.MissingJson, outcome == null ? null : outcome.MissingJson)
                .SetProperty(e => e.FitScore, outcome == null ? (int?)null : outcome.FitScore)
                .SetProperty(e => e.Decision, outcome == null ? null : outcome.Decision)
                .SetProperty(e => e.DecisionReason, outcome == null ? null : outcome.DecisionReason)
                .SetProperty(e => e.ErrorCode, errorCode)
                .SetProperty(e => e.ErrorMessage, errorMessage)
                .SetProperty(e => e.FinishedAt, DateTime.UtcNow)
                .SetProperty(e => e.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<int> RequeueStaleRunningAsync(CancellationToken ct = default)
    {
        await _db.Database.ExecuteSqlRawAsync(
            "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = OFF);", ct);
        try
        {
            return await _db.Database.ExecuteSqlRawAsync(
                "UPDATE dbo.CvScreening " +
                "SET status = 'PENDING', started_at = NULL, updated_at = SYSUTCDATETIME() " +
                "WHERE status = 'RUNNING'", ct);
        }
        finally
        {
            await _db.Database.ExecuteSqlRawAsync(
                "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = ON);", CancellationToken.None);
        }
    }

    /// <summary>
    /// Wrapper cho SqlQueryRaw — EF map theo tên property nên không dùng thẳng record
    /// <see cref="ClaimedScreening"/> được (giống ClaimedRow trong CriteriaExtractionRepo).
    /// </summary>
    private class ClaimedRow
    {
        public long ScreeningId { get; set; }
        public long CompanyId { get; set; }
        public long ApplicationId { get; set; }
    }
}
