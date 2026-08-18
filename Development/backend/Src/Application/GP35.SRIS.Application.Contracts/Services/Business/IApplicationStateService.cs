using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// State machine hồ sơ (docs 5.8): 6 state, forward-only, guard G2 (≥1 phiếu chấm SUBMITTED).
/// Lý do loại là tùy chọn. Mỗi transition ghi ActivityLog (audit).
/// </summary>
public interface IApplicationStateService : IBaseService
{
    /// <summary>
    /// Chuyển hồ sơ sang state đích (gồm cả REJECTED). Kiểm luật + guard + ghi log.
    /// </summary>
    /// <param name="isCandidateAnswer">
    /// true = đang GHI NHẬN câu trả lời của ứng viên với thư mời nhận việc (5.15), không phải
    /// một quyết định tuyển mới -> bỏ qua luật "chỉ DM của job được quyết" (5.14). Ứng viên nhận
    /// hay từ chối là sự thật khách quan; bắt đúng DM mới được gõ vào sẽ làm hồ sơ kẹt ở OFFER
    /// trong khi offer đã ACCEPTED. Quyết định thật đã xảy ra ở cửa INTERVIEW→OFFER.
    /// </param>
    /// <param name="interviewerIds">
    /// Người phỏng vấn Trưởng bộ phận chỉ định cho ứng viên này (V045) — CHỈ dùng khi
    /// <paramref name="toState"/> = INTERVIEW. Cùng một lần bấm "Duyệt vào phỏng vấn" là một
    /// quyết định trọn vẹn: cho vào vòng phỏng vấn VÀ cho gặp những ai. Null/rỗng = không đụng
    /// tới danh sách đang có.
    /// </param>
    Task<ApplicationStateDto> TransitionAsync(
        long companyId, long userId, long applicationId, string toState, string? reason,
        bool isCandidateAnswer = false, IReadOnlyList<long>? interviewerIds = null);

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
