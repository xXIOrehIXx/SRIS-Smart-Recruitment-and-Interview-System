using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
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

    public async Task<ApplicationContactInfo?> GetContactInfoAsync(long companyId, long applicationId)
    {
        // Join Candidate (email/tên) + Job (tên vị trí). Global Query Filter kèm company_id mọi bảng.
        return await (
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            where a.ApplicationId == applicationId
            select new ApplicationContactInfo(
                a.ApplicationId, c.Email, c.FullName, j.Title, a.CurrentState))
            .FirstOrDefaultAsync();
    }

    public async Task<IReadOnlyList<ApplicationBoardRow>> GetBoardByJobAsync(long companyId, long jobId)
    {
        // Toàn bộ hồ sơ của job cho Kanban; FE tự nhóm theo current_state. Mới nộp trước.
        return await (
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            where a.JobId == jobId
            orderby a.CreatedAt descending
            select new ApplicationBoardRow(
                a.ApplicationId, a.CandidateId, c.FullName, c.Email,
                a.CurrentState, a.CvId, a.CreatedAt))
            .ToListAsync();
    }

    public async Task<ApplicationDetailRow?> GetDetailAsync(long companyId, long applicationId)
    {
        return await (
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            join cv in _db.CvDocuments.AsNoTracking() on a.CvId equals cv.CvId
            where a.ApplicationId == applicationId
            select new ApplicationDetailRow(
                a.ApplicationId, a.CurrentState,
                a.RejectReason, a.CreatedAt, a.StageUpdatedAt,
                c.CandidateId, c.FullName, c.Email, c.Phone, c.Source,
                j.JobId, j.Title,
                cv.CvId, cv.FileName, cv.ParseStatus))
            .FirstOrDefaultAsync();
    }
}
