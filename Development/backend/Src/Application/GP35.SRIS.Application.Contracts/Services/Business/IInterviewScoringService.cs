using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Collaborative Scoring (docs 5.7). Interviewer chấm độc lập trong Portal: nháp riêng tư
/// (Blind Review), submit mới mở blind. Tổng hợp Radar (trung bình từng tiêu chí) + std dev (đồng thuận).
/// </summary>
public interface IInterviewScoringService : IBaseService
{
    /// <summary>Các buổi được giao cho interviewer hiện tại.</summary>
    Task<IReadOnlyList<MyScheduleDto>> GetMySchedulesAsync(long companyId, long interviewerId);

    /// <summary>Phiếu chấm của interviewer cho 1 buổi (chỉ điểm của chính họ).</summary>
    Task<ScoringSheetDto> GetSheetAsync(long companyId, long interviewerId, long scheduleId);

    /// <summary>Lưu nháp (tự lưu server). Sửa được tới khi nộp/khóa.</summary>
    Task<ScoringSheetDto> SaveDraftAsync(long companyId, long interviewerId, long scheduleId, SaveScoreDraftDto dto);

    /// <summary>Nộp phiếu (DRAFT->SUBMITTED) — mở blind. Guard: phải chấm đủ mọi tiêu chí.</summary>
    Task<ScoringSheetDto> SubmitAsync(long companyId, long interviewerId, long scheduleId);

    /// <summary>Tổng hợp panel (chỉ phiếu đã nộp) — cho Human Resource/Department Manager đọc để quyết.</summary>
    Task<ScheduleAggregateDto> GetAggregateAsync(long companyId, long scheduleId);

    /// <summary>
    /// Tổng hợp điểm phỏng vấn của 1 HỒ SƠ, theo từng vòng (vòng nhỏ trước). Màn "Quyết định
    /// tuyển dụng" của DM dùng cái này: 1 lần gọi ra đủ điểm từng tiêu chí của mọi vòng.
    /// Buổi chưa ai nộp phiếu vẫn trả về (SubmittedInterviewers = 0) để DM biết là còn thiếu.
    /// </summary>
    Task<IReadOnlyList<ScheduleAggregateDto>> GetAggregatesByApplicationAsync(long companyId, long applicationId);

    /// <summary>
    /// Bản tóm tắt cho người quyết tuyển (5.14): panel kết luận gì và VÌ SAO, kèm note theo
    /// tiêu chí + ghi chú nội bộ. KHÔNG có điểm số — người quyết đọc nhận xét rồi chốt.
    /// </summary>
    Task<DecisionBriefDto> GetDecisionBriefAsync(long companyId, long applicationId);
}
