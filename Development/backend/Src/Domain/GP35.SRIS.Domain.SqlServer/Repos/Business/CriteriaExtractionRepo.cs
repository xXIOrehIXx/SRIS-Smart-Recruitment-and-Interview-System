using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CriteriaExtractionRepo : BaseRepo<long, CriteriaExtraction>, ICriteriaExtractionRepo
{
    private readonly SrisDbContext _db;

    public CriteriaExtractionRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<CriteriaExtraction> EnqueueAsync(long companyId, long jobId, long requestedBy)
    {
        var now = DateTime.UtcNow;

        // UNIQUE(job_id) -> bấm bóc lại là ghi đè lượt cũ, không xếp hàng chồng lên nhau.
        // Xoá sạch dấu vết lượt trước (error_code/criteria_count/finished_at) để FE không
        // đọc nhầm kết quả cũ trong lúc lượt mới còn PENDING.
        var existing = await _db.CriteriaExtractions.FirstOrDefaultAsync(e => e.JobId == jobId);
        if (existing is not null)
        {
            existing.Status = ExtractionStatus.Pending;
            existing.ErrorCode = null;
            existing.ErrorMessage = null;
            existing.CriteriaCount = null;
            existing.RequestedBy = requestedBy;
            existing.RequestedAt = now;
            existing.StartedAt = null;
            existing.FinishedAt = null;
            existing.UpdatedAt = now;
            await _db.SaveChangesAsync();
            return existing;
        }

        var entity = new CriteriaExtraction
        {
            CompanyId = companyId,
            JobId = jobId,
            Status = ExtractionStatus.Pending,
            RequestedBy = requestedBy,
            RequestedAt = now,
            CreatedAt = now
        };
        _db.CriteriaExtractions.Add(entity);
        await _db.SaveChangesAsync();
        return entity;
    }

    public async Task<CriteriaExtraction?> GetByJobAsync(long companyId, long jobId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.CriteriaExtractions
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.JobId == jobId);
    }

    public async Task<ClaimedExtraction?> ClaimNextPendingAsync(CancellationToken ct = default)
    {
        // Worker không chạy trong request nào nên SESSION_CONTEXT('CompanyId') chưa set ->
        // RLS lọc sạch mọi dòng. Tắt policy đúng trong lúc chạy câu lệnh giành việc (cùng
        // cách UserRepo.GetByEmail làm cho luồng login ẩn danh), rồi bật lại ngay.
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
                    "UPDATE TOP(1) e SET status = 'RUNNING', started_at = SYSUTCDATETIME(), " +
                    "       updated_at = SYSUTCDATETIME() " +
                    "OUTPUT inserted.extraction_id AS ExtractionId, " +
                    "       inserted.company_id AS CompanyId, " +
                    "       inserted.job_id AS JobId " +
                    "FROM dbo.CriteriaExtraction e WITH (READPAST) " +
                    "WHERE e.status = 'PENDING'")
                .ToListAsync(ct);

            var row = rows.FirstOrDefault();
            return row is null ? null : new ClaimedExtraction(row.ExtractionId, row.CompanyId, row.JobId);
        }
        finally
        {
            await _db.Database.ExecuteSqlRawAsync(
                "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = ON);", CancellationToken.None);
        }
    }

    public async Task FinishAsync(long companyId, long extractionId, string status,
        int? criteriaCount, string? errorCode, string? errorMessage)
    {
        // Gọi trong scope đã set tenant -> Global Query Filter + RLS khớp, không cần tắt policy.
        await _db.CriteriaExtractions
            .Where(e => e.ExtractionId == extractionId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(e => e.Status, status)
                .SetProperty(e => e.CriteriaCount, criteriaCount)
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
                "UPDATE dbo.CriteriaExtraction " +
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
    /// <see cref="ClaimedExtraction"/> được (giống ExpiredJobRow trong JobRepo).
    /// </summary>
    private class ClaimedRow
    {
        public long ExtractionId { get; set; }
        public long CompanyId { get; set; }
        public long JobId { get; set; }
    }
}
