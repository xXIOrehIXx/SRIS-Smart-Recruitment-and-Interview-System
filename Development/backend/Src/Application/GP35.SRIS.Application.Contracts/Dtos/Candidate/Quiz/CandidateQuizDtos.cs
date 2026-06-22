namespace GP35.SRIS.Application.Contracts.Dtos.Candidate.Quiz;

/// <summary>
/// Đề quiz hiển thị cho ứng viên — KHÔNG bao giờ kèm đáp án đúng (chấm ở server).
/// remainingSeconds tính ở server (timer-lượt tách khỏi TTL — 5.6).
/// </summary>
public class CandidateQuizDto
{
    public long AttemptId { get; set; }
    public long QuizId { get; set; }
    public string? JobTitle { get; set; }

    /// <summary>Tổng thời gian làm bài (phút). Null = không giới hạn.</summary>
    public int? DurationMin { get; set; }

    /// <summary>Số giây còn lại của lượt (server tính từ started_at). Null = không có timer.</summary>
    public int? RemainingSeconds { get; set; }

    /// <summary>Ngưỡng chuyển tab tối đa trước khi khóa bài (anti-cheat — công khai cho ứng viên, 5.5).</summary>
    public int TabSwitchLimit { get; set; }

    public List<CandidateQuestionDto> Questions { get; set; } = new();
}

/// <summary>1 câu hỏi cho ứng viên: chỉ nội dung + các phương án, KHÔNG có đáp án đúng.</summary>
public class CandidateQuestionDto
{
    public long QuestionId { get; set; }
    public string Content { get; set; } = null!;
    public List<string> Options { get; set; } = new();
}

/// <summary>Ứng viên lưu/đổi 1 đáp án (nháp). selectedOption = nhãn 'A'/'B'/...</summary>
public class SaveAnswerDto
{
    public long QuestionId { get; set; }
    public string? SelectedOption { get; set; }
}

/// <summary>FE báo 1 sự kiện anti-cheat phát hiện ở trình duyệt.</summary>
public class AntiCheatEventDto
{
    /// <summary>TAB_SWITCH | BLUR | PASTE | COPY | DEVTOOLS | MULTI_MONITOR | FULLSCREEN_EXIT | DISCONNECT | VISIBILITY_HIDDEN</summary>
    public string EventType { get; set; } = null!;
    public string? Detail { get; set; }
}

/// <summary>Phản hồi sau khi ghi 1 sự kiện anti-cheat.</summary>
public class AntiCheatAckDto
{
    /// <summary>True nếu vượt ngưỡng -> bài đã bị server tự nộp/khóa.</summary>
    public bool Locked { get; set; }
    public int RiskScore { get; set; }
}

/// <summary>Kết quả sau khi nộp (hoặc bị tự nộp).</summary>
public class QuizResultDto
{
    public long AttemptId { get; set; }
    public decimal Score { get; set; }
    public int CorrectCount { get; set; }
    public int TotalQuestions { get; set; }

    /// <summary>SUBMITTED | AUTO_SUBMITTED</summary>
    public string Status { get; set; } = null!;
}
