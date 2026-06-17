using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class ApplicationRepo : BaseRepo<long, Application>, IApplicationRepo
{
    private readonly SrisDbContext _db;

    public ApplicationRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, Application application)
    {
        application.CompanyId = companyId;
        _db.Applications.Add(application);
        await _db.SaveChangesAsync();
        return application.ApplicationId;
    }

    public async Task<double> GetCvJdCosineDistanceAsync(long companyId, long cvId, long jobId)
    {
        // VECTOR_DISTANCE đo ngay trong SQL Server (cửa thoát raw SQL — 5.11). Khoảng cách nhỏ = giống nhiều.
        return await _db.Database
            .SqlQueryRaw<double>(
                "SELECT VECTOR_DISTANCE('cosine', c.embedding, j.embedding) AS Value " +
                "FROM CvDocument c CROSS JOIN Job j " +
                "WHERE c.cv_id = {0} AND c.company_id = {2} " +
                "  AND j.job_id = {1} AND j.company_id = {2}",
                cvId, jobId, companyId)
            .SingleAsync();
    }

    public async Task UpdateScoreAsync(long companyId, long applicationId, decimal score)
    {
        // ExecuteUpdate tôn trọng Global Query Filter (tự kèm company_id).
        await _db.Applications
            .Where(a => a.ApplicationId == applicationId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.AiMatchScore, score)
                .SetProperty(a => a.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<IEnumerable<ApplicationRankingRow>> GetRankingByJobAsync(long companyId, long jobId)
    {
        // Join Candidate lấy tên; Global Query Filter kèm company_id trên cả hai bảng (cùng tenant).
        return await (
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            where a.JobId == jobId
            orderby a.AiMatchScore descending
            select new ApplicationRankingRow(
                a.ApplicationId, a.CandidateId, c.FullName, a.AiMatchScore, a.CurrentState))
            .ToListAsync();
    }
}
