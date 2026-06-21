namespace GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;

/// <summary>1 bộ quiz của job (DRAFT khi AI vừa sinh, READY khi Recruiter đã duyệt — 5.6).</summary>
public class QuizDto
{
    public long QuizId { get; set; }
    public long JobId { get; set; }

    /// <summary>"MCQ" (hiện chỉ hỗ trợ MCQ).</summary>
    public string Type { get; set; } = null!;

    /// <summary>"DRAFT" | "READY".</summary>
    public string Status { get; set; } = null!;

    public bool GeneratedByAi { get; set; }
    public int QuestionCount => Questions?.Count ?? 0;
    public List<QuizQuestionDto> Questions { get; set; } = new();
}
