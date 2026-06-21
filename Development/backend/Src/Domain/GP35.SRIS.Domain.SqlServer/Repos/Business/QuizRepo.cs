using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class QuizRepo : BaseRepo<long, Quiz>, IQuizRepo
{
    private readonly SrisDbContext _db;

    public QuizRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertQuizWithQuestionsAsync(
        long companyId, Quiz quiz, IEnumerable<QuizQuestion> questions)
    {
        quiz.CompanyId = companyId;

        // quiz_id là IDENTITY -> phải lưu Quiz trước để có id rồi mới gắn vào câu hỏi.
        // Bọc trong 1 transaction để Quiz + câu hỏi cùng thành công hoặc cùng rollback.
        await using var tx = await _db.Database.BeginTransactionAsync();

        _db.Quizzes.Add(quiz);
        await _db.SaveChangesAsync();

        foreach (var q in questions)
        {
            q.CompanyId = companyId;
            q.QuizId = quiz.QuizId;
            _db.QuizQuestions.Add(q);
        }
        await _db.SaveChangesAsync();

        await tx.CommitAsync();
        return quiz.QuizId;
    }

    public async Task<QuizWithQuestions?> GetByIdAsync(long companyId, long quizId)
    {
        var quiz = await _db.Quizzes
            .AsNoTracking()
            .FirstOrDefaultAsync(q => q.QuizId == quizId);
        if (quiz is null)
            return null;

        var questions = await LoadQuestionsAsync(quizId);
        return new QuizWithQuestions(quiz, questions);
    }

    public async Task<QuizWithQuestions?> GetLatestByJobAsync(long companyId, long jobId)
    {
        var quiz = await _db.Quizzes
            .AsNoTracking()
            .Where(q => q.JobId == jobId)
            .OrderByDescending(q => q.QuizId)
            .FirstOrDefaultAsync();
        if (quiz is null)
            return null;

        var questions = await LoadQuestionsAsync(quiz.QuizId);
        return new QuizWithQuestions(quiz, questions);
    }

    public async Task AddQuestionsAsync(long companyId, long quizId, IEnumerable<QuizQuestion> questions)
    {
        foreach (var q in questions)
        {
            q.CompanyId = companyId;
            q.QuizId = quizId;
            _db.QuizQuestions.Add(q);
        }
        await _db.SaveChangesAsync();
    }

    public async Task<QuizQuestion?> GetQuestionAsync(long companyId, long quizId, long questionId)
    {
        return await _db.QuizQuestions
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.QuestionId == questionId && x.QuizId == quizId);
    }

    public async Task UpdateQuestionAsync(long companyId, QuizQuestion question)
    {
        // Cập nhật đúng các cột nội dung; Global Query Filter chặn sửa nhầm sang tenant khác.
        var rows = await _db.QuizQuestions
            .Where(x => x.QuestionId == question.QuestionId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Content, question.Content)
                .SetProperty(x => x.OptionsJson, question.OptionsJson)
                .SetProperty(x => x.CorrectOption, question.CorrectOption)
                .SetProperty(x => x.Points, question.Points)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        if (rows == 0)
            throw new InvalidOperationException($"Không cập nhật được câu hỏi (question_id={question.QuestionId}).");
    }

    public async Task UpdateStatusAsync(long companyId, long quizId, string status)
    {
        var rows = await _db.Quizzes
            .Where(q => q.QuizId == quizId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(q => q.Status, status)
                .SetProperty(q => q.UpdatedAt, DateTime.UtcNow));

        if (rows == 0)
            throw new InvalidOperationException($"Không cập nhật được trạng thái quiz (quiz_id={quizId}).");
    }

    private async Task<IReadOnlyList<QuizQuestion>> LoadQuestionsAsync(long quizId)
    {
        return await _db.QuizQuestions
            .AsNoTracking()
            .Where(x => x.QuizId == quizId)
            .OrderBy(x => x.QuestionId)
            .ToListAsync();
    }
}
