namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>Recruiter tạo 1 tiêu chí chấm cho job (per-job — 5.7).</summary>
public class CriteriaInputDto
{
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; } = 1;
    public decimal MaxScore { get; set; } = 10;
}

/// <summary>Recruiter sửa 1 tiêu chí (gồm bật/tắt).</summary>
public class CriteriaUpdateDto
{
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; } = 1;
    public decimal MaxScore { get; set; } = 10;
    public bool Active { get; set; } = true;
}

public class CriteriaDto
{
    public long CriteriaId { get; set; }
    public long JobId { get; set; }
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; }
    public decimal MaxScore { get; set; }
    public bool Active { get; set; }
}
