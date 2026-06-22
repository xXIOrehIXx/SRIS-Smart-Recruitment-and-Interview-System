using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

public interface IQuizAttemptRepo : IBaseRepo<long, QuizAttempt>
{
    /// <summary>Quiz READY mới nhất của 1 job (chỉ READY mới phát cho ứng viên — 5.6). Null nếu chưa có.</summary>
    Task<long?> GetReadyQuizIdByJobAsync(long companyId, long jobId);

    /// <summary>Lượt làm mới nhất của hồ sơ cho 1 quiz (để resume nếu đang dở / chặn nộp lại). Null nếu chưa có.</summary>
    Task<QuizAttempt?> GetLatestAttemptAsync(long companyId, long applicationId, long quizId);

    /// <summary>Guard G1: hồ sơ đã có ít nhất 1 lượt quiz đã nộp (SUBMITTED/AUTO_SUBMITTED) chưa?</summary>
    Task<bool> HasSubmittedAttemptAsync(long companyId, long applicationId);

    /// <summary>Tạo lượt làm mới, trả về attempt_id.</summary>
    Task<long> InsertAttemptAsync(long companyId, QuizAttempt attempt);

    /// <summary>Lưu/ghi đè 1 đáp án nháp (UNIQUE attempt+question). is_correct để null tới khi chấm.</summary>
    Task UpsertAnswerAsync(long companyId, long attemptId, long questionId, string? selectedOption);

    /// <summary>Các đáp án đã chọn của 1 lượt (để chấm).</summary>
    Task<IReadOnlyList<QuizAnswer>> GetAnswersAsync(long companyId, long attemptId);

    /// <summary>Ghi 1 sự kiện anti-cheat và cộng dồn risk_score của lượt làm.</summary>
    Task InsertEventAsync(long companyId, AntiCheatEvent ev, int riskDelta);

    /// <summary>Đếm số sự kiện 1 loại của lượt (vd TAB_SWITCH để so ngưỡng).</summary>
    Task<int> CountEventsAsync(long companyId, long attemptId, string eventType);

    /// <summary>Chốt lượt làm: ghi is_correct từng câu + điểm + trạng thái + tổng thời gian (1 transaction).</summary>
    Task FinalizeAttemptAsync(
        long companyId, long attemptId, decimal score, int durationSeconds, string status,
        IReadOnlyDictionary<long, bool> correctness);
}
