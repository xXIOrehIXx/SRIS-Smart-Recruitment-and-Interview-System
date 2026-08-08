using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class InterviewScoreRepo : BaseRepo<long, InterviewScore>, IInterviewScoreRepo
{
    private readonly SrisDbContext _db;

    public InterviewScoreRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<IReadOnlyList<InterviewScore>> GetByScheduleAndInterviewerAsync(
        long companyId, long scheduleId, long interviewerId)
    {
        return await _db.InterviewScores
            .AsNoTracking()
            .Where(s => s.ScheduleId == scheduleId && s.InterviewerId == interviewerId)
            .ToListAsync();
    }

    public async Task UpsertAsync(
        long companyId, long scheduleId, long interviewerId, long criteriaId, decimal? score, string? note)
    {
        // KHÔNG set status ở đây: dòng mới mặc định DRAFT; sửa điểm đã SUBMITTED thì GIỮ SUBMITTED
        // (docs 5.7 — sửa điểm đã gửi tới khi buổi/vòng bị khóa).
        var rows = await _db.InterviewScores
            .Where(s => s.ScheduleId == scheduleId && s.InterviewerId == interviewerId && s.CriteriaId == criteriaId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Score, score)
                .SetProperty(x => x.Note, note)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        if (rows == 0)
        {
            _db.InterviewScores.Add(new InterviewScore
            {
                CompanyId = companyId,
                ScheduleId = scheduleId,
                InterviewerId = interviewerId,
                CriteriaId = criteriaId,
                Score = score,
                Note = note,
                Status = InterviewScoreStatus.Draft
            });
            await _db.SaveChangesAsync();
        }
    }

    public async Task<int> SubmitAsync(long companyId, long scheduleId, long interviewerId)
    {
        return await _db.InterviewScores
            .Where(s => s.ScheduleId == scheduleId && s.InterviewerId == interviewerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, InterviewScoreStatus.Submitted)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<IReadOnlyList<InterviewScore>> GetSubmittedByScheduleAsync(long companyId, long scheduleId)
    {
        // BLIND REVIEW: chỉ trả phiếu đã nộp — không bao giờ lộ nháp của người khác (coding rule #5).
        return await _db.InterviewScores
            .AsNoTracking()
            .Where(s => s.ScheduleId == scheduleId && s.Status == InterviewScoreStatus.Submitted)
            .ToListAsync();
    }

    // ----- Kết luận của người phỏng vấn (V031) -----

    public async Task<InterviewFeedback?> GetFeedbackAsync(long companyId, long scheduleId, long interviewerId)
    {
        return await _db.InterviewFeedbacks
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.ScheduleId == scheduleId && f.InterviewerId == interviewerId);
    }

    public async Task UpsertFeedbackAsync(
        long companyId, long scheduleId, long interviewerId, string? recommendation, string? summary)
    {
        // Không đụng submitted_at: đã nộp rồi sửa lại thì VẪN là đã nộp (giống điểm — 5.7).
        var rows = await _db.InterviewFeedbacks
            .Where(f => f.ScheduleId == scheduleId && f.InterviewerId == interviewerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Recommendation, recommendation)
                .SetProperty(x => x.Summary, summary)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        if (rows == 0)
        {
            _db.InterviewFeedbacks.Add(new InterviewFeedback
            {
                CompanyId = companyId,
                ScheduleId = scheduleId,
                InterviewerId = interviewerId,
                Recommendation = recommendation,
                Summary = summary
            });
            await _db.SaveChangesAsync();
        }
    }

    public async Task<int> SubmitFeedbackAsync(long companyId, long scheduleId, long interviewerId)
    {
        return await _db.InterviewFeedbacks
            .Where(f => f.ScheduleId == scheduleId && f.InterviewerId == interviewerId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.SubmittedAt, DateTime.UtcNow)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<IReadOnlyList<InterviewFeedback>> GetSubmittedFeedbackByScheduleAsync(
        long companyId, long scheduleId)
    {
        // BLIND REVIEW: submitted_at NULL = còn nháp -> không lộ (coding rule #5).
        return await _db.InterviewFeedbacks
            .AsNoTracking()
            .Where(f => f.ScheduleId == scheduleId && f.SubmittedAt != null)
            .ToListAsync();
    }
}
