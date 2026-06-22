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

    public async Task<Application?> GetByIdAsync(long companyId, long applicationId)
    {
        return await _db.Applications
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId);
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

    public async Task<int> TransitionStateAsync(
        long companyId, long applicationId, string toState, string? rejectReason,
        DateTime stageUpdatedAt, DateTime? rejectedAt, DateTime? hiredAt)
    {
        // ExecuteUpdate tôn trọng Global Query Filter (tự kèm company_id); RLS BLOCK chặn ghi sai tenant.
        return await _db.Applications
            .Where(a => a.ApplicationId == applicationId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.CurrentState, toState)
                .SetProperty(a => a.RejectReason, rejectReason)
                .SetProperty(a => a.StageUpdatedAt, stageUpdatedAt)
                .SetProperty(a => a.RejectedAt, rejectedAt)
                .SetProperty(a => a.HiredAt, hiredAt)
                .SetProperty(a => a.UpdatedAt, stageUpdatedAt));
    }

    public async Task<int> CountSubmittedInterviewScoresAsync(long companyId, long applicationId)
    {
        // InterviewScore nối hồ sơ qua InterviewSchedule (chưa map entity -> raw SQL, cửa thoát 5.11).
        return await _db.Database
            .SqlQueryRaw<int>(
                "SELECT COUNT(*) AS Value " +
                "FROM InterviewScore sc " +
                "JOIN InterviewSchedule s ON s.schedule_id = sc.schedule_id " +
                "WHERE s.application_id = {0} AND s.company_id = {1} " +
                "  AND sc.company_id = {1} AND sc.status = 'SUBMITTED'",
                applicationId, companyId)
            .SingleAsync();
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
