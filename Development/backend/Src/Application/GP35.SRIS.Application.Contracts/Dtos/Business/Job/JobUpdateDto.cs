namespace GP35.SRIS.Application.Contracts.Dtos;

/// <summary>Recruiter sửa Job (gồm đóng job qua Status = "Closed"). V020: mở rộng field.</summary>
public class JobUpdateDto
{
    public string Title { get; set; } = null!;
    public string? JdText { get; set; }
    /// <summary>DM quyết tuyển (5.14). Null = Recruiter quyết.</summary>
    public long? DepartmentManagerId { get; set; }
    /// <summary>Open | Closed.</summary>
    public string Status { get; set; } = "Open";

    public string? Department { get; set; }
    public string? Location { get; set; }
    public string? EmploymentType { get; set; }
    public string? WorkMode { get; set; }
    public string? ExperienceLevel { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string? Currency { get; set; }
    public DateTime? Deadline { get; set; }
    public List<string>? Requirements { get; set; }
    public List<string>? Benefits { get; set; }
}
