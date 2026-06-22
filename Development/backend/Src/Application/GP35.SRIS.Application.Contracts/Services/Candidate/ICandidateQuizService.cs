using GP35.SRIS.Application.Contracts.Dtos.Candidate.Quiz;

namespace GP35.SRIS.Application.Contracts.Services.CandidatePortal;

/// <summary>
/// Luồng ứng viên làm quiz qua magic link (docs 5.6). Vào bằng token purpose=QUIZ (không login).
/// Timer-lượt + chấm điểm + ngưỡng anti-cheat đều quyết ở SERVER (không tin client).
/// </summary>
public interface ICandidateQuizService : IBaseService
{
    /// <summary>Mở/khôi phục bài: trả đề (ẩn đáp án) + số giây còn lại. Tự nộp nếu đã hết giờ.</summary>
    Task<CandidateQuizDto> StartAsync(string rawToken, string? ipAddress);

    /// <summary>Lưu 1 đáp án nháp (chưa chốt). Mở lại link vẫn còn.</summary>
    Task SaveAnswerAsync(string rawToken, SaveAnswerDto dto);

    /// <summary>Ghi 1 sự kiện anti-cheat từ trình duyệt; có thể khóa/tự nộp nếu vượt ngưỡng.</summary>
    Task<AntiCheatAckDto> RecordEventAsync(string rawToken, AntiCheatEventDto dto);

    /// <summary>Ứng viên CHỐT nộp bài: chấm điểm, đốt token. One-time đốt ở đây (5.13).</summary>
    Task<QuizResultDto> SubmitAsync(string rawToken);
}
