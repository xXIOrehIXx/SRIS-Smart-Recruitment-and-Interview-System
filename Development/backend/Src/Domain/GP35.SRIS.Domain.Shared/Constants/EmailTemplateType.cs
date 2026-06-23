namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Loại email template động (M4) — khớp các điểm trigger của <c>NotificationService</c>.
/// 4 loại đầu trùng magic-link purpose (5.13); 2 loại kết quả + 1 loại xác nhận lịch.
/// Placeholder hỗ trợ: {{candidateName}}, {{jobTitle}}, {{link}}, {{expiresAt}}, {{startTime}}.
/// </summary>
public static class EmailTemplateType
{
    public const string Quiz = "QUIZ";
    public const string Schedule = "SCHEDULE";
    public const string OfferResponse = "OFFER_RESPONSE";
    public const string Status = "STATUS";
    public const string Hired = "HIRED";
    public const string Rejected = "REJECTED";
    public const string InterviewConfirmed = "INTERVIEW_CONFIRMED";

    public static readonly string[] All =
        { Quiz, Schedule, OfferResponse, Status, Hired, Rejected, InterviewConfirmed };

    public static bool IsValid(string? type) =>
        type is not null && All.Any(t => string.Equals(t, type, StringComparison.OrdinalIgnoreCase));
}
