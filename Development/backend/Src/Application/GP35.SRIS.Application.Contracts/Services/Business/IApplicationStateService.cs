using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// State machine hồ sơ (docs 5.8): forward-only, guard G1 (quiz đã nộp) / G2 (≥1 phiếu chấm SUBMITTED),
/// reject bắt buộc reason. Mỗi transition ghi ActivityLog (audit).
/// </summary>
public interface IApplicationStateService : IBaseService
{
    /// <summary>Chuyển hồ sơ sang state đích (gồm cả REJECTED). Kiểm luật + guard + ghi log.</summary>
    Task<ApplicationStateDto> TransitionAsync(
        long companyId, long userId, long applicationId, string toState, string? reason);

    /// <summary>Loại hồ sơ (REJECTED) — tiện ích, reason bắt buộc.</summary>
    Task<ApplicationStateDto> RejectAsync(long companyId, long userId, long applicationId, string reason);
}
