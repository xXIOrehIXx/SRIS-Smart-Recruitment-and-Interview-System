namespace GP35.SRIS.Application.Contracts.Dtos.Business.EmploymentType;

/// <summary>Admin tạo/sửa hình thức làm việc (V027).</summary>
public class EmploymentTypeInputDto
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    /// <summary>Active | Inactive (mặc định Active; Inactive = ẩn khỏi dropdown).</summary>
    public string? Status { get; set; }
}

public class EmploymentTypeDto
{
    public long EmploymentTypeId { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string Status { get; set; } = "Active";
    /// <summary>Số job đang dùng hình thức này (tham chiếu bằng tên).</summary>
    public int JobCount { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
