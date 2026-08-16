using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Người phỏng vấn được Trưởng bộ phận chỉ định cho một ứng viên (V045 — chốt 16/08/2026).
///
/// Phân vai: DM chọn AI GẶP AI (chuyên môn), bộ phận nhân sự chọn GẶP LÚC NÀO (vận hành).
/// Trước V045 nhân sự truyền id tùy ý khi đặt buổi, tức là họ đang quyết cả hai.
/// </summary>
public interface IInterviewPanelService : IBaseService
{
    /// <summary>
    /// Danh sách người phỏng vấn đã chỉ định cho hồ sơ (kèm tên/email để đổ dropdown).
    /// Rỗng = DM chưa chỉ định -> nhân sự chưa đặt lịch được.
    /// </summary>
    Task<IReadOnlyList<InterviewerMiniDto>> GetAsync(long companyId, long applicationId);

    /// <summary>
    /// Chỉ định (ghi đè) danh sách người phỏng vấn cho hồ sơ.
    /// </summary>
    /// <param name="alreadyAuthorized">
    /// true = người gọi ĐÃ kiểm quyền quyết định của hồ sơ này rồi, bỏ qua bước kiểm ở đây.
    /// Dùng cho đường DM duyệt vào vòng phỏng vấn (<c>ApplicationStateService</c> vừa chạy
    /// <c>EnsureCanDecideAsync</c> xong) — kiểm lại lần nữa chỉ tốn một truy vấn Job.
    /// </param>
    Task AssignAsync(
        long companyId, long userId, long applicationId, IReadOnlyList<long> interviewerIds,
        bool alreadyAuthorized = false);

    /// <summary>
    /// Kiểm danh sách id có dùng được không (số lượng, trùng, có thật trong công ty và đang
    /// hoạt động) mà KHÔNG ghi gì. Dùng để chặn sớm: duyệt ứng viên vào vòng phỏng vấn xong mới
    /// phát hiện id rác thì hồ sơ đã sang INTERVIEW mà không có ai được chỉ định.
    /// </summary>
    Task ValidateAsync(long companyId, IReadOnlyList<long> interviewerIds);
}
