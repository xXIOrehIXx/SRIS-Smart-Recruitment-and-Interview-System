namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Email tự động cho ứng viên (docs 5.13 "Actionable Email" / Việc 6). Best-effort: lỗi gửi mail
/// KHÔNG làm hỏng pipeline (chỉ log). Mọi method nuốt exception, không ném ra ngoài.
/// </summary>
public interface INotificationService : IBaseService
{
    /// <summary>
    /// Gửi email kèm nút magic link cho ứng viên theo purpose (QUIZ mời làm bài, SCHEDULE mời chọn lịch,
    /// OFFER_RESPONSE gửi offer, STATUS xem trạng thái). Token gốc nhúng vào URL frontend.
    /// </summary>
    Task SendMagicLinkAsync(long companyId, long applicationId, string purpose, string rawToken, DateTime expiresAt);

    /// <summary>Email thông báo kết quả khi hồ sơ chốt: HIRED (chúc mừng) / REJECTED (cảm ơn lịch sự).</summary>
    Task SendResultAsync(long companyId, long applicationId, string toState);

    /// <summary>
    /// Email xác nhận lịch phỏng vấn sau khi ứng viên chốt khung: kèm file .ics đính kèm +
    /// link "Add to Google Calendar" (không cần API). startTimeUtc = giờ khung đã chốt (UTC).
    /// </summary>
    Task SendInterviewConfirmedAsync(long companyId, long applicationId, DateTime startTimeUtc);

    /// <summary>
    /// Email báo ứng viên lịch phỏng vấn đã bị hủy. startTimeUtc = giờ đã chốt trước đó (null nếu chưa chốt);
    /// reason = lý do hủy (tùy chọn) hiển thị trong email.
    /// </summary>
    Task SendInterviewCancelledAsync(long companyId, long applicationId, DateTime? startTimeUtc, string? reason);
}
