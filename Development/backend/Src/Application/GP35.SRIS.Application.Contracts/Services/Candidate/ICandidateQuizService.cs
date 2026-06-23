using GP35.SRIS.Application.Contracts.Dtos.Candidate.Quiz;

namespace GP35.SRIS.Application.Contracts.Services.CandidatePortal;

/// <summary>
/// Luồng ứng viên làm quiz qua magic link (docs 5.6). Vào bằng token purpose=QUIZ (không login).
/// Timer-lượt + chấm điểm + ngưỡng anti-cheat đều quyết ở SERVER (không tin client).
/// </summary>
public interface ICandidateQuizService : IBaseService
{
    /// <summary>
    /// Mở/khôi phục bài. Lượt đầu (chưa đồng ý) trả về màn hình Disclosure &amp; Consent
    /// (RequiresConsent=true, chưa có đề, chưa chạy timer — 5.5). Đã đồng ý thì trả đề + số giây còn lại.
    /// Tự nộp nếu đã hết giờ.
    /// </summary>
    Task<CandidateQuizDto> StartAsync(string rawToken, string? ipAddress);

    /// <summary>
    /// Ứng viên tick đồng ý (có giám sát + làm bài độc lập — 5.5): tạo lượt làm, đóng dấu
    /// consent_at + started_at (timer bắt đầu), rồi phát đề. Idempotent nếu đã đồng ý.
    /// </summary>
    Task<CandidateQuizDto> AcceptConsentAsync(string rawToken, string? ipAddress);

    /// <summary>Lưu 1 đáp án nháp (chưa chốt). Mở lại link vẫn còn.</summary>
    Task SaveAnswerAsync(string rawToken, SaveAnswerDto dto);

    /// <summary>Ghi 1 sự kiện anti-cheat từ trình duyệt; có thể khóa/tự nộp nếu vượt ngưỡng.</summary>
    Task<AntiCheatAckDto> RecordEventAsync(string rawToken, AntiCheatEventDto dto);

    /// <summary>Ứng viên CHỐT nộp bài: chấm điểm, đốt token. One-time đốt ở đây (5.13).</summary>
    Task<QuizResultDto> SubmitAsync(string rawToken);
}
