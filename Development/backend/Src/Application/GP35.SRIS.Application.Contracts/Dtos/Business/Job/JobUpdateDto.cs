namespace GP35.SRIS.Application.Contracts.Dtos;

/// <summary>Recruiter sửa Job (gồm đóng job qua Status = "Closed").</summary>
public class JobUpdateDto
{
    public string Title { get; set; } = null!;
    public string? JdText { get; set; }
    /// <summary>DM quyết tuyển (5.14). Null = Recruiter quyết.</summary>
    public long? DepartmentManagerId { get; set; }
    /// <summary>Open | Closed.</summary>
    public string Status { get; set; } = "Open";
}
