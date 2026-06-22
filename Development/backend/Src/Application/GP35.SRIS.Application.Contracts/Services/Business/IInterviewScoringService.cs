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

    /// <summary>Tổng hợp panel (chỉ phiếu đã nộp) — cho Recruiter/Department Manager đọc để quyết.</summary>
    Task<ScheduleAggregateDto> GetAggregateAsync(long companyId, long scheduleId);
}
