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
}
