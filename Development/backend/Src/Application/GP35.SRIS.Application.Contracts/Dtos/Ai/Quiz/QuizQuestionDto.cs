namespace GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;

/// <summary>1 câu hỏi MCQ trong quiz.</summary>
public class QuizQuestionDto
{
    public long QuestionId { get; set; }

    /// <summary>Nội dung câu hỏi.</summary>
    public string Content { get; set; } = null!;

    /// <summary>4 phương án trả lời.</summary>
    public List<string> Options { get; set; } = new();

    /// <summary>Chỉ số (bắt đầu 0) của phương án đúng trong <see cref="Options"/>.</summary>
    public int CorrectIndex { get; set; }

    public int Points { get; set; }
}
