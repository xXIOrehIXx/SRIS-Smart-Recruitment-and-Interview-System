using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 quiz kèm danh sách câu hỏi (entity không có navigation property).</summary>
public record QuizWithQuestions(Quiz Quiz, IReadOnlyList<QuizQuestion> Questions);

public interface IQuizRepo : IBaseRepo<long, Quiz>
{
    /// <summary>Tạo Quiz + N câu hỏi trong 1 transaction. Trả về quiz_id IDENTITY.</summary>
    Task<long> InsertQuizWithQuestionsAsync(long companyId, Quiz quiz, IEnumerable<QuizQuestion> questions);

    /// <summary>Lấy 1 quiz kèm câu hỏi (order theo question_id). Null nếu không có trong company.</summary>
    Task<QuizWithQuestions?> GetByIdAsync(long companyId, long quizId);

    /// <summary>Lấy quiz mới nhất của 1 job kèm câu hỏi. Null nếu job chưa có quiz.</summary>
    Task<QuizWithQuestions?> GetLatestByJobAsync(long companyId, long jobId);

    /// <summary>Nối thêm câu hỏi vào 1 quiz đã có.</summary>
    Task AddQuestionsAsync(long companyId, long quizId, IEnumerable<QuizQuestion> questions);

    /// <summary>Lấy 1 câu hỏi (lọc theo quiz + company). Null nếu không thuộc quiz này.</summary>
    Task<QuizQuestion?> GetQuestionAsync(long companyId, long quizId, long questionId);

    /// <summary>Cập nhật nội dung/đáp án 1 câu hỏi (sửa tay hoặc gen lại thay tại chỗ).</summary>
    Task UpdateQuestionAsync(long companyId, QuizQuestion question);

    /// <summary>Đổi trạng thái quiz (vd DRAFT -> READY).</summary>
    Task UpdateStatusAsync(long companyId, long quizId, string status);
}
