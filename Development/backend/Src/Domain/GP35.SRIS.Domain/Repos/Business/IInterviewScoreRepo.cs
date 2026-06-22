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
}
