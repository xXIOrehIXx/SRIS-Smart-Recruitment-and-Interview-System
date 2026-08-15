namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Loại email template động (M4) — khớp các điểm trigger của <c>NotificationService</c>.
/// 2 loại đầu trùng magic-link purpose (5.13); 2 loại kết quả + 2 loại lịch phỏng vấn.
/// Loại SCHEDULE đã bỏ cùng luồng ứng viên tự chọn khung (15/08/2026).
/// Placeholder hỗ trợ: {{candidateName}}, {{jobTitle}}, {{link}}, {{expiresAt}}, {{startTime}}.
/// </summary>
public static class EmailTemplateType
{
    public const string OfferResponse = "OFFER_RESPONSE";
    public const string Status = "STATUS";
    public const string Hired = "HIRED";
    public const string Rejected = "REJECTED";
    public const string InterviewConfirmed = "INTERVIEW_CONFIRMED";
    public const string InterviewCancelled = "INTERVIEW_CANCELLED";

    /// <summary>
    /// Email chào mừng + hướng dẫn ngày đầu đi làm, gửi khi hồ sơ sang HIRED.
    /// KHÁC <see cref="Hired"/> (thông báo kết quả): loại này chứa thông tin thực tế của công
    /// ty nên chỉ gửi khi người tuyển dụng đã soạn mẫu — xem <see cref="OnboardingEmailDefault"/>.
    /// </summary>
    public const string Onboarding = "ONBOARDING";

    public static readonly string[] All =
        { OfferResponse, Status, Hired, Rejected, InterviewConfirmed, InterviewCancelled, Onboarding };

    public static bool IsValid(string? type) =>
        type is not null && All.Any(t => string.Equals(t, type, StringComparison.OrdinalIgnoreCase));
}
