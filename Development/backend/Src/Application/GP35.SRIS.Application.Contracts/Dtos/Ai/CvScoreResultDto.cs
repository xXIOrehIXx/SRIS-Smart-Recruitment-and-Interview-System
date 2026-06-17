namespace GP35.SRIS.Application.Contracts.Dtos.Ai;

/// <summary>Kết quả chấm điểm 1 CV.</summary>
public class CvScoreResultDto
{
    /// <summary>"SCORED" | "NEEDS_MANUAL_EDIT" | "FAILED".</summary>
    public string Status { get; set; } = null!;

    /// <summary>Lý do khi không chấm được (scan ảnh / file hỏng...).</summary>
    public string? Reason { get; set; }

    public long? ApplicationId { get; set; }
    public long? CandidateId { get; set; }
    public long? CvId { get; set; }
    public string? CandidateName { get; set; }

    /// <summary>Điểm phù hợp 0-100 (chỉ có khi Status = SCORED).</summary>
    public decimal? Score { get; set; }

    /// <summary>Khoảng cách cosine CV ↔ JD (càng nhỏ càng giống).</summary>
    public double? CosineDistance { get; set; }

    public int? PageCount { get; set; }
    public int? CharCount { get; set; }

    /// <summary>200 ký tự đầu của text bóc ra (để kiểm tra nhanh).</summary>
    public string? ExtractPreview { get; set; }
}
