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
}
