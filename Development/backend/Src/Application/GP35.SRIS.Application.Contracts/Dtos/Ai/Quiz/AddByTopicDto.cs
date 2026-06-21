using System.ComponentModel.DataAnnotations;

namespace GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;

/// <summary>Nút "Thêm câu theo chủ đề" — gen 1 câu ràng buộc chủ đề Recruiter gõ (vd "Docker").</summary>
public class AddByTopicDto
{
    [Required]
    public string Topic { get; set; } = null!;
}
