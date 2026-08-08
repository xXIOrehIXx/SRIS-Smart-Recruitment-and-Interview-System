using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// Phiếu chấm phỏng vấn — Blind Review (docs 5.7). Mỗi (schedule, interviewer, criteria) 1 dòng.
/// Điểm/note của người khác CHỈ lộ khi đã SUBMITTED — repo tổng hợp chỉ trả phiếu SUBMITTED.
/// </summary>
public interface IInterviewScoreRepo : IBaseRepo<long, InterviewScore>
{
    /// <summary>Phiếu của CHÍNH interviewer này cho 1 buổi (nháp + đã nộp của riêng họ).</summary>
    Task<IReadOnlyList<InterviewScore>> GetByScheduleAndInterviewerAsync(
        long companyId, long scheduleId, long interviewerId);

    /// <summary>Lưu/ghi đè 1 điểm (theo UNIQUE schedule+interviewer+criteria). KHÔNG đổi status.</summary>
    Task UpsertAsync(long companyId, long scheduleId, long interviewerId, long criteriaId, decimal? score, string? note);

    /// <summary>Nộp phiếu: mọi dòng của interviewer ở buổi này -> SUBMITTED. Trả số dòng đã nộp.</summary>
    Task<int> SubmitAsync(long companyId, long scheduleId, long interviewerId);

    /// <summary>CHỈ phiếu đã SUBMITTED của buổi (cho tổng hợp Radar + std dev — blind đã mở).</summary>
    Task<IReadOnlyList<InterviewScore>> GetSubmittedByScheduleAsync(long companyId, long scheduleId);

    // ----- Kết luận của người phỏng vấn (V031) — cùng vòng đời với phiếu chấm -----

    /// <summary>Kết luận của CHÍNH interviewer này cho buổi (kể cả còn nháp). Null nếu chưa viết.</summary>
    Task<InterviewFeedback?> GetFeedbackAsync(long companyId, long scheduleId, long interviewerId);

    /// <summary>Lưu/ghi đè kết luận (theo UNIQUE schedule+interviewer). KHÔNG đóng dấu nộp.</summary>
    Task UpsertFeedbackAsync(
        long companyId, long scheduleId, long interviewerId, string? recommendation, string? summary);

    /// <summary>Đóng dấu nộp kết luận (mở blind). Trả số dòng cập nhật.</summary>
    Task<int> SubmitFeedbackAsync(long companyId, long scheduleId, long interviewerId);

    /// <summary>CHỈ kết luận ĐÃ NỘP của buổi — nguồn cho màn quyết định của người quyết tuyển.</summary>
    Task<IReadOnlyList<InterviewFeedback>> GetSubmittedFeedbackByScheduleAsync(long companyId, long scheduleId);
}
