using GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;

namespace GP35.SRIS.Application.Contracts.Services.Ai;

/// <summary>
/// Điều phối quiz AI (5.6): AI gen từ JD -> DRAFT -> Recruiter duyệt (DRAFT->READY).
/// Các "nút hành động AI" (gen thêm / gen lại / thêm theo chủ đề) đều là lệnh gen đơn,
/// stateless, KHÔNG chat. Quiz AI luôn sinh ở DRAFT, chỉ READY mới phát cho ứng viên.
/// </summary>
public interface IQuizService : IBaseService
{
    /// <summary>AI gen quiz mới từ JD của job -> tạo Quiz DRAFT + N câu hỏi.</summary>
    Task<QuizDto> GenerateFromJdAsync(long companyId, long jobId, int numQuestions = 10);

    /// <summary>Nút "Gen thêm N câu" — sinh thêm từ cùng JD, nối vào quiz DRAFT (tránh trùng câu cũ).</summary>
    Task<QuizDto> AddQuestionsAsync(long companyId, long quizId, int count = 1);

    /// <summary>Nút "Gen lại câu này" — sinh 1 câu mới thay tại chỗ (giữ vị trí câu cũ).</summary>
    Task<QuizDto> RegenerateQuestionAsync(long companyId, long quizId, long questionId);

    /// <summary>Nút "Thêm câu theo chủ đề" — gen 1 câu ràng buộc chủ đề, nối vào quiz DRAFT.</summary>
    Task<QuizDto> AddByTopicAsync(long companyId, long quizId, string topic);

    /// <summary>"Sửa tay" — Recruiter tự sửa nội dung/đáp án 1 câu (không gọi AI).</summary>
    Task<QuizDto> UpdateQuestionAsync(long companyId, long quizId, long questionId, UpdateQuizQuestionDto dto);

    /// <summary>Recruiter duyệt: DRAFT -> READY (guard: quiz đang DRAFT và có ≥1 câu hỏi).</summary>
    Task<QuizDto> ApproveAsync(long companyId, long quizId);

    /// <summary>Lấy 1 quiz kèm câu hỏi. Null nếu không tồn tại trong company.</summary>
    Task<QuizDto?> GetByIdAsync(long companyId, long quizId);

    /// <summary>Lấy quiz mới nhất của 1 job. Null nếu job chưa có quiz nào.</summary>
    Task<QuizDto?> GetLatestByJobAsync(long companyId, long jobId);
}
