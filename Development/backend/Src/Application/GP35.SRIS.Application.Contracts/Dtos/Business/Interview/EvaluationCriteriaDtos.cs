namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>Recruiter/DM tạo 1 tiêu chí cho job (per-job — 5.7, 5.18).</summary>
public class CriteriaInputDto
{
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; } = 1;
    public decimal MaxScore { get; set; } = 10;
    /// <summary>HARD (yêu cầu cứng — lọc rule/keyword) | SOFT (kỹ năng — so vector). Mặc định SOFT.</summary>
    public string CriteriaType { get; set; } = "SOFT";
    /// <summary>true = thấy được trong CV; false = chỉ đánh giá khi phỏng vấn (chấm CV bỏ qua).</summary>
    public bool CvMatchable { get; set; } = true;
    /// <summary>Từ khóa nhận diện cho HARD, phân tách ';'. Trống -> dùng Name.</summary>
    public string? Keywords { get; set; }
}

/// <summary>Recruiter sửa 1 tiêu chí (gồm bật/tắt + phân loại).</summary>
public class CriteriaUpdateDto
{
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; } = 1;
    public decimal MaxScore { get; set; } = 10;
    public bool Active { get; set; } = true;
    public string CriteriaType { get; set; } = "SOFT";
    public bool CvMatchable { get; set; } = true;
    public string? Keywords { get; set; }
}

public class CriteriaDto
{
    public long CriteriaId { get; set; }
    public long JobId { get; set; }
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; }
    public decimal MaxScore { get; set; }
    public bool Active { get; set; }
    public string CriteriaType { get; set; } = "SOFT";
    public bool CvMatchable { get; set; } = true;
    public string? Keywords { get; set; }
    /// <summary>DRAFT (AI bóc, chờ duyệt) | APPROVED (đã chốt — mới dùng để chấm).</summary>
    public string Status { get; set; } = "APPROVED";
    /// <summary>MANUAL | AI_EXTRACTED — audit "tiêu chí từ đâu ra" (5.18).</summary>
    public string Source { get; set; } = "MANUAL";
}
