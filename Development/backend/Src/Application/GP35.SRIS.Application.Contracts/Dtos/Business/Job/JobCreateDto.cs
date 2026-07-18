using System.ComponentModel.DataAnnotations;

namespace GP35.SRIS.Application.Contracts.Dtos;

/// <summary>Body tạo Job mới (Recruiter tạo job + JD — docs 6, 5.14). V020: mở rộng field cho form CreateJob.</summary>
public class JobCreateDto
{
    [Required]
    [MaxLength(300)]
    public string Title { get; set; } = null!;

    /// <summary>Mô tả công việc (JD). Cần có để hệ thống chấm điểm CV bằng vector.</summary>
    public string? JdText { get; set; }

    /// <summary>Người quyết tuyển (Department Manager). Để trống = Recruiter quyết (docs 5.14).</summary>
    public long? DepartmentManagerId { get; set; }

    /// <summary>Trạng thái: Draft | Open | Closed. Để trống = Open.</summary>
    [RegularExpression("^(Draft|Open|Closed)$", ErrorMessage = "Status phải là Draft, Open hoặc Closed.")]
    public string? Status { get; set; }

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
