namespace GP35.SRIS.Application.Contracts.Dtos.Business.Department;

/// <summary>Admin tạo/sửa phòng ban.</summary>
public class DepartmentInputDto
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    /// <summary>Active | Inactive (mặc định Active; Inactive = ẩn khỏi dropdown).</summary>
    public string? Status { get; set; }
    /// <summary>
    /// DM phụ trách phòng ban (V023) — job thuộc phòng này sẽ tự lấy DM đó làm người quyết tuyển.
    /// Null = bỏ trống (job phải chọn DM tay). Phải là user Active role DepartmentManager/Admin.
    /// </summary>
    public long? ManagerUserId { get; set; }
}

public class DepartmentDto
{
    public long DepartmentId { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string Status { get; set; } = "Active";
    /// <summary>Số job đang dùng phòng ban này (tham chiếu bằng tên).</summary>
    public int JobCount { get; set; }
    /// <summary>DM phụ trách (V023). Null = chưa gán.</summary>
    public long? ManagerUserId { get; set; }
    /// <summary>Tên hiển thị của DM (rơi về email khi user chưa điền full_name).</summary>
    public string? ManagerName { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
