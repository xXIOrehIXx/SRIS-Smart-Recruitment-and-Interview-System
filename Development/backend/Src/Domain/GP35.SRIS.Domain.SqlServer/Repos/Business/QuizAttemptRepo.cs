using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class QuizAttemptRepo : BaseRepo<long, QuizAttempt>, IQuizAttemptRepo
{
    private readonly SrisDbContext _db;

    public QuizAttemptRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long?> GetReadyQuizIdByJobAsync(long companyId, long jobId)
    {
        return await _db.Quizzes
            .AsNoTracking()
            .Where(q => q.JobId == jobId && q.Status == "READY")
            .OrderByDescending(q => q.QuizId)
            .Select(q => (long?)q.QuizId)
            .FirstOrDefaultAsync();
    }

    public async Task<QuizAttempt?> GetLatestAttemptAsync(long companyId, long applicationId, long quizId)
    {
        return await _db.QuizAttempts
            .AsNoTracking()
            .Where(a => a.ApplicationId == applicationId && a.QuizId == quizId)
            .OrderByDescending(a => a.AttemptId)
            .FirstOrDefaultAsync();
    }

    public async Task<bool> HasSubmittedAttemptAsync(long companyId, long applicationId)
    {
        return await _db.QuizAttempts
            .AsNoTracking()
            .AnyAsync(a => a.ApplicationId == applicationId
                && (a.Status == "SUBMITTED" || a.Status == "AUTO_SUBMITTED"));
    }

    public async Task<long> InsertAttemptAsync(long companyId, QuizAttempt attempt)
    {
        attempt.CompanyId = companyId;
        _db.QuizAttempts.Add(attempt);
        await _db.SaveChangesAsync();
        return attempt.AttemptId;
    }

    public async Task UpsertAnswerAsync(long companyId, long attemptId, long questionId, string? selectedOption)
    {
        var now = DateTime.UtcNow;
        var rows = await _db.QuizAnswers
            .Where(a => a.AttemptId == attemptId && a.QuestionId == questionId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.SelectedOption, selectedOption)
                .SetProperty(a => a.AnsweredAt, now));

        if (rows == 0)
        {
            _db.QuizAnswers.Add(new QuizAnswer
            {
                CompanyId = companyId,
                AttemptId = attemptId,
                QuestionId = questionId,
                SelectedOption = selectedOption,
                AnsweredAt = now
            });
            await _db.SaveChangesAsync();
        }
    }

    public async Task<IReadOnlyList<QuizAnswer>> GetAnswersAsync(long companyId, long attemptId)
    {
        return await _db.QuizAnswers
            .AsNoTracking()
            .Where(a => a.AttemptId == attemptId)
            .ToListAsync();
    }

    public async Task InsertEventAsync(long companyId, AntiCheatEvent ev, int riskDelta)
    {
        ev.CompanyId = companyId;
        if (ev.OccurredAt == default) ev.OccurredAt = DateTime.UtcNow;

        await using var tx = await _db.Database.BeginTransactionAsync();

        _db.AntiCheatEvents.Add(ev);
        await _db.SaveChangesAsync();

        if (riskDelta != 0)
        {
            await _db.QuizAttempts
                .Where(a => a.AttemptId == ev.AttemptId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.RiskScore, a => a.RiskScore + riskDelta));
        }

        await tx.CommitAsync();
    }

    public async Task<int> CountEventsAsync(long companyId, long attemptId, string eventType)
    {
        return await _db.AntiCheatEvents
            .AsNoTracking()
            .CountAsync(e => e.AttemptId == attemptId && e.EventType == eventType);
    }

    public async Task FinalizeAttemptAsync(
        long companyId, long attemptId, decimal score, int durationSeconds, string status,
        IReadOnlyDictionary<long, bool> correctness)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        foreach (var (questionId, isCorrect) in correctness)
        {
            await _db.QuizAnswers
                .Where(a => a.AttemptId == attemptId && a.QuestionId == questionId)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.IsCorrect, isCorrect));
        }

        await _db.QuizAttempts
            .Where(a => a.AttemptId == attemptId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.Score, score)
                .SetProperty(a => a.DurationSeconds, durationSeconds)
                .SetProperty(a => a.Status, status)
                .SetProperty(a => a.SubmittedAt, DateTime.UtcNow));

        await tx.CommitAsync();
    }
}
