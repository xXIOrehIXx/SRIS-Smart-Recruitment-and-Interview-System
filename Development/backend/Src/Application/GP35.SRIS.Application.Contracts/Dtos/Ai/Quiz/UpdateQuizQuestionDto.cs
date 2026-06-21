using System.ComponentModel.DataAnnotations;

namespace GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;

/// <summary>Recruiter sửa tay 1 câu hỏi (không gọi AI — 5.6 "Sửa tay").</summary>
public class UpdateQuizQuestionDto
{
    [Required]
    public string Content { get; set; } = null!;

    /// <summary>Đúng 4 phương án.</summary>
    [Required]
    [MinLength(2)]
    public List<string> Options { get; set; } = new();

    /// <summary>Chỉ số (bắt đầu 0) của phương án đúng.</summary>
    [Range(0, int.MaxValue)]
    public int CorrectIndex { get; set; }

    /// <summary>Điểm của câu (mặc định 1 nếu &lt;= 0).</summary>
    public int Points { get; set; } = 1;
}
