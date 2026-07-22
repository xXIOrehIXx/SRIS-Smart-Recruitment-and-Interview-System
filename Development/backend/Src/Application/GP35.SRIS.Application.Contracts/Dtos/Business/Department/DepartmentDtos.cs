namespace GP35.SRIS.Application.Contracts.Dtos.Business.Department;

/// <summary>Admin tạo/sửa phòng ban.</summary>
public class DepartmentInputDto
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    /// <summary>Active | Inactive (mặc định Active; Inactive = ẩn khỏi dropdown).</summary>
    public string? Status { get; set; }
}

public class DepartmentDto
{
    public long DepartmentId { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string Status { get; set; } = "Active";
    /// <summary>Số job đang dùng phòng ban này (tham chiếu bằng tên).</summary>
    public int JobCount { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
