namespace GP35.SRIS.Application.Contracts.Dtos.Business.Request;

/// <summary>DM tạo/sửa Yêu cầu tuyển dụng (docs 5.17 — "ra đề", tùy chọn).</summary>
public class RecruitmentRequestInputDto
{
    public string Title { get; set; } = null!;
    public string? Department { get; set; }
    public int Quantity { get; set; } = 1;
    public string? EmploymentType { get; set; }
    public string? ExperienceLevel { get; set; }
    /// <summary>LOW | MEDIUM | HIGH (mặc định MEDIUM).</summary>
    public string? Priority { get; set; }
    public string? Description { get; set; }
    public string? Requirements { get; set; }
    public string? Benefits { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public DateTime? ExpectedStartDate { get; set; }
}

/// <summary>Recruiter duyệt yêu cầu: approve=true -> APPROVED, false -> REJECTED (kèm note).</summary>
public class ReviewRequestDto
{
    public bool Approve { get; set; }
    public string? Note { get; set; }
}

/// <summary>Recruiter đánh dấu đã tạo Job từ yêu cầu -> CONVERTED + truy vết job_id.</summary>
public class ConvertRequestDto
{
    public long JobId { get; set; }
}

public class RecruitmentRequestDto
{
    public long RequestId { get; set; }
    public string Title { get; set; } = null!;
    public string? Department { get; set; }
    public int Quantity { get; set; }
    public string? EmploymentType { get; set; }
    public string? ExperienceLevel { get; set; }
    public string Priority { get; set; } = "MEDIUM";
    public string? Description { get; set; }
    public string? Requirements { get; set; }
    public string? Benefits { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public DateTime? ExpectedStartDate { get; set; }

    /// <summary>PENDING | APPROVED | REJECTED | CONVERTED | CANCELLED.</summary>
    public string Status { get; set; } = "PENDING";
    public string? ReviewNote { get; set; }
    public string? ReviewedByName { get; set; }
    public DateTime? ReviewedAt { get; set; }

    public long? JobId { get; set; }
    public long? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public DateTime? CreatedAt { get; set; }
}
