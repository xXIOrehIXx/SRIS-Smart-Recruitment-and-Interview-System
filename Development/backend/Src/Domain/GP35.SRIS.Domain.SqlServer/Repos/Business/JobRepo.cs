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

    public async Task UpdateEmbeddingAsync(long companyId, long jobId, float[] embedding)
    {
        // CAST chuỗi JSON -> VECTOR(384) ở phía SQL Server (cửa thoát raw SQL — 5.11).
        var vectorJson = JsonSerializer.Serialize(embedding);
        await _db.Database.ExecuteSqlRawAsync(
            "UPDATE Job SET embedding = CAST({0} AS VECTOR(384)), updated_at = SYSUTCDATETIME() " +
            "WHERE company_id = {1} AND job_id = {2}",
            vectorJson, companyId, jobId);
    }
}
