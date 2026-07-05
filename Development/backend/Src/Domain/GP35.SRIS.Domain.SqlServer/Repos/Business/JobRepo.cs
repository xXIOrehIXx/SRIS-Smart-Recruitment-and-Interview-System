using System.Text.Json;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class JobRepo : BaseRepo<long, Job>, IJobRepo
{
    private readonly SrisDbContext _db;

    public JobRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, Job job)
    {
        job.CompanyId = companyId;
        _db.Jobs.Add(job);
        await _db.SaveChangesAsync();
        return job.JobId; // EF đọc lại khóa IDENTITY + created_at (store-generated) sau khi lưu
    }

    public async Task<IEnumerable<Job>> GetListByCompanyAsync(long companyId)
    {
        // Global Query Filter tự kèm company_id; AsNoTracking cho truy vấn đọc.
        return await _db.Jobs
            .AsNoTracking()
            .OrderByDescending(j => j.JobId)
            .ToListAsync();
    }

    public async Task<Job?> GetByIdAsync(long companyId, long jobId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.JobId == jobId);
    }

    public async Task<JobEmbeddingInfo?> GetEmbeddingInfoAsync(long companyId, long jobId)
    {
        // jd_text lấy qua LINQ (Global Query Filter tự kèm company_id).
        var job = await _db.Jobs
            .AsNoTracking()
            .Where(j => j.JobId == jobId)
            .Select(j => new { j.JobId, j.JdText })
            .FirstOrDefaultAsync();

        if (job is null)
            return null;

        // Cờ "đã có embedding chưa": cột VECTOR không map được nên hỏi bằng raw SQL.
        var hasEmbedding = await _db.Database
            .SqlQueryRaw<int>(
                "SELECT CAST(CASE WHEN embedding IS NULL THEN 0 ELSE 1 END AS INT) AS Value " +
                "FROM Job WHERE job_id = {0} AND company_id = {1}",
                jobId, companyId)
            .SingleAsync();

        return new JobEmbeddingInfo(job.JobId, job.JdText, hasEmbedding == 1);
    }

    public async Task<int> UpdateAsync(long companyId, long jobId, string title, string? jdText,
        long? departmentManagerId, string status, bool jdChanged)
    {
        var rows = await _db.Jobs
            .Where(j => j.JobId == jobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.Title, title)
                .SetProperty(j => j.JdText, jdText)
                .SetProperty(j => j.DepartmentManagerId, departmentManagerId)
                .SetProperty(j => j.Status, status)
                .SetProperty(j => j.UpdatedAt, DateTime.UtcNow));

        if (rows > 0 && jdChanged)
        {
            // JD đổi -> vector cũ vô nghĩa; NULL để lần chấm sau lazy embed lại.
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE Job SET embedding = NULL WHERE job_id = {0} AND company_id = {1}",
                jobId, companyId);
        }
        return rows;
    }

    public async Task UpdateEmbeddingAsync(long companyId, long jobId, float[] embedding)
    {
        // CAST chuỗi JSON -> VECTOR(1024) ở phía SQL Server (cửa thoát raw SQL — 5.11).
        var vectorJson = JsonSerializer.Serialize(embedding);
        await _db.Database.ExecuteSqlRawAsync(
            "UPDATE Job SET embedding = CAST({0} AS VECTOR(1024)), updated_at = SYSUTCDATETIME() " +
            "WHERE company_id = {1} AND job_id = {2}",
            vectorJson, companyId, jobId);
    }

    public async Task<IEnumerable<Job>> GetPublicOpenJobsAsync()
    {
        // Public endpoint: bỏ qua global query filter company_id
        return await _db.Jobs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .OrderByDescending(j => j.CreatedAt)
            .ToListAsync();
    }

    public async Task<Job?> GetPublicOpenJobAsync(long jobId)
    {
        // Public endpoint: bỏ qua global query filter company_id
        return await _db.Jobs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(j => j.JobId == jobId && j.Status == "Open")
            .FirstOrDefaultAsync();
    }
}
