namespace GP35.SRIS.Application.Contracts.Dtos.Ai.Criteria;

/// <summary>Kết quả 1 tiêu chí trên 1 hồ sơ: khớp/thiếu + bằng chứng (docs 5.18).</summary>
public class CriterionMatchDto
{
    public long CriteriaId { get; set; }
    public string Name { get; set; } = null!;
    /// <summary>HARD (lọc rule) | SOFT (so vector).</summary>
    public string Type { get; set; } = null!;
    public decimal Weight { get; set; }
    public bool Matched { get; set; }
    /// <summary>Cosine similarity 0-1 (chỉ SOFT; HARD = null).</summary>
    public decimal? Similarity { get; set; }
    /// <summary>Đoạn CV làm bằng chứng — khớp gì/thiếu gì đọc được ngay, không chỉ con số.</summary>
    public string? Evidence { get; set; }
}

/// <summary>Bảng khớp/thiếu của 1 hồ sơ + điểm tổng có trọng số.</summary>
public class CriteriaMatchResultDto
{
    public long ApplicationId { get; set; }
    /// <summary>Điểm 0-100 = tổng có trọng số các tiêu chí khớp (nhóm CV_MATCHABLE). Null = chưa chấm.</summary>
    public decimal? CriteriaScore { get; set; }
    /// <summary>false nếu rớt ít nhất 1 tiêu chí HARD (yêu cầu cứng) — cờ đỏ cho người sàng lọc.</summary>
    public bool HardPassed { get; set; }
    public DateTime? EvaluatedAt { get; set; }
    public List<CriterionMatchDto> Matches { get; set; } = new();
}
