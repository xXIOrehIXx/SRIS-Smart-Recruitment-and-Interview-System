using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// State machine hồ sơ (docs 5.8): 6 state, forward-only, guard G2 (≥1 phiếu chấm SUBMITTED).
/// Lý do loại là tùy chọn. Mỗi transition ghi ActivityLog (audit).
/// </summary>
public interface IApplicationStateService : IBaseService
{
    /// <summary>Chuyển hồ sơ sang state đích (gồm cả REJECTED). Kiểm luật + guard + ghi log.</summary>
    Task<ApplicationStateDto> TransitionAsync(
        long companyId, long userId, long applicationId, string toState, string? reason);

    /// <summary>Loại hồ sơ (REJECTED) — tiện ích, reason tùy chọn.</summary>
    Task<ApplicationStateDto> RejectAsync(long companyId, long userId, long applicationId, string? reason);

    /// <summary>
    /// Đẩy hồ sơ TIẾN tới <paramref name="targetState"/>, đi từng bước một theo state machine
    /// (NEW→SCREENING→INTERVIEW…) và ghi ActivityLog cho từng bước — dùng khi một hành động
    /// nghiệp vụ ngụ ý hồ sơ đã sang bước đó (vd mời phỏng vấn = đang ở bước Phỏng vấn), để
    /// người dùng không phải sang Kanban kéo tay.
    /// <para>
    /// Đã ở đúng state hoặc đã đi xa hơn -> không làm gì (idempotent). Hồ sơ HIRED/REJECTED
    /// hoặc không có đường tiến tới đích -> ném Conflict.
    /// </para>
    /// </summary>
    Task AdvanceToAsync(long companyId, long userId, long applicationId, string targetState);
}
