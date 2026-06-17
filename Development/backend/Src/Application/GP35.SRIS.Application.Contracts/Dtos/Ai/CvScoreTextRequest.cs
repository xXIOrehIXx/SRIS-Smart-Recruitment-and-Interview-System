using System.ComponentModel.DataAnnotations;

namespace GP35.SRIS.Application.Contracts.Dtos.Ai;

/// <summary>Body nộp CV dạng TEXT (không qua file PDF).</summary>
public class CvScoreTextRequest
{
    [Required]
    public long JobId { get; set; }

    [Required]
    public string CandidateName { get; set; } = null!;

    [Required]
    [EmailAddress]
    public string CandidateEmail { get; set; } = null!;

    [Required]
    public string CvText { get; set; } = null!;
}
