using GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;

namespace GP35.SRIS.Application.Contracts.Services.Ai;

/// <summary>
/// Quản lý ngân hàng câu hỏi đã duyệt (5.6 / Việc 12). Duyệt/duyệt lại không qua đây — bank tự bồi
/// khi Recruiter duyệt quiz (xem <c>IQuizService.ApproveAsync</c>). Service này lo phần XEM/QUẢN LÝ bank.
/// </summary>
public interface IQuestionBankService : IBaseService
{
    /// <summary>Tìm câu trong bank theo chủ đề/từ khoá (phân trang). page bắt đầu từ 1.</summary>
    Task<QuestionBankSearchResultDto> SearchAsync(
        long companyId, string? topic, string? search, int page = 1, int pageSize = 20);

    /// <summary>Ẩn 1 câu khỏi bank (không xoá cứng). Trả false nếu không tìm thấy.</summary>
    Task<bool> DeactivateAsync(long companyId, long bankItemId);
}
