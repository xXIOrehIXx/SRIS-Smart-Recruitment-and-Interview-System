using System.ComponentModel.DataAnnotations;

namespace GP35.SRIS.Application.Contracts.Dtos;

/// <summary>Human Resource sửa Job (gồm đóng job qua Status = "Closed"). V020: mở rộng field.</summary>
public class JobUpdateDto
{
    public string Title { get; set; } = null!;
    public string? JdText { get; set; }
    /// <summary>DM quyết tuyển (5.14). Null = Human Resource quyết.</summary>
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

    /// <summary>Số lượng cần tuyển. Để trống -> giữ nguyên số cũ.</summary>
    [Range(1, 999, ErrorMessage = "Số lượng tuyển phải từ 1 đến 999.")]
    public int? Quantity { get; set; }

    public List<string>? Requirements { get; set; }
    public List<string>? Benefits { get; set; }

    /// <summary>Kỹ năng — xem <see cref="JobCreateDto.Skills"/>.</summary>
    public List<string>? Skills { get; set; }
}
