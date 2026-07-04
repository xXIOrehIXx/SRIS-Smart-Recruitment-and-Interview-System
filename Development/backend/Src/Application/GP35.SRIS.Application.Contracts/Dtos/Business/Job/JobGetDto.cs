namespace GP35.SRIS.Application.Contracts.Dtos;

/// <summary>Job trả về cho client (chỉ các cột có trong schema local — không lộ embedding).</summary>
public class JobGetDto
{
    public long JobId { get; set; }
    public long CompanyId { get; set; }
    public string Title { get; set; } = null!;
    public string? JdText { get; set; }
    public long? DepartmentManagerId { get; set; }
    /// <summary>Recruiter đã tạo job (user_id). NULL = chưa rõ người tạo.</summary>
    public long? CreatedBy { get; set; }
    public string Status { get; set; } = null!;
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Các trường mở rộng cho public API
    public string? Department { get; set; }
    public string? Location { get; set; }
    public string? EmploymentType { get; set; }
    public int Quantity { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public string? Salary { get; set; }
    public string? ExperienceLevel { get; set; }
    public string? WorkMode { get; set; }
    public DateTime? Deadline { get; set; }
    public List<string>? Skills { get; set; }
    public List<string>? Benefits { get; set; }
    public List<string>? Requirements { get; set; }
    public int ApplicationCount { get; set; }
}

/// <summary>Job trả về cho API công khai (không cần login).</summary>
public class PublicJobDto
{
    public long Id { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public string? Department { get; set; }
    public string? Location { get; set; }
    public string? JobType { get; set; }
    public string? ExperienceLevel { get; set; }
    public string? WorkMode { get; set; }
    public string? Salary { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public DateTime? Deadline { get; set; }
    public DateTime? PostedDate { get; set; }
    public List<string>? Skills { get; set; }
    public List<string>? Benefits { get; set; }
    public List<string>? Requirements { get; set; }
    public int ApplicationCount { get; set; }
}
