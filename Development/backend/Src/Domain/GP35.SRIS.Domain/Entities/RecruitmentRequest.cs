using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Yêu cầu tuyển dụng — DM "ra đề" (docs 5.17, TÙY CHỌN). Recruiter duyệt rồi tạo Job
/// từ yêu cầu (status CONVERTED + job_id truy vết "job này từ đề bài nào").
/// </summary>
public class RecruitmentRequest : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("request_id")]
    public long RequestId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("title")]
    public string Title { get; set; } = null!;
    [Column("department")]
    public string? Department { get; set; }
    [Column("quantity")]
    public int Quantity { get; set; } = 1;
    [Column("employment_type")]
    public string? EmploymentType { get; set; }
    [Column("experience_level")]
    public string? ExperienceLevel { get; set; }
    /// <summary>LOW | MEDIUM | HIGH.</summary>
    [Column("priority")]
    public string Priority { get; set; } = "MEDIUM";
    [Column("description")]
    public string? Description { get; set; }
    [Column("requirements")]
    public string? Requirements { get; set; }
    [Column("benefits")]
    public string? Benefits { get; set; }
    [Column("salary_min")]
    public decimal? SalaryMin { get; set; }
    [Column("salary_max")]
    public decimal? SalaryMax { get; set; }
    [Column("expected_start_date")]
    public DateTime? ExpectedStartDate { get; set; }

    /// <summary>PENDING | APPROVED | REJECTED | CONVERTED | CANCELLED.</summary>
    [Column("status")]
    public string Status { get; set; } = "PENDING";
    [Column("review_note")]
    public string? ReviewNote { get; set; }
    [Column("reviewed_by")]
    public long? ReviewedBy { get; set; }
    [Column("reviewed_at")]
    public DateTime? ReviewedAt { get; set; }

    /// <summary>Job đã tạo từ yêu cầu này (khi CONVERTED).</summary>
    [Column("job_id")]
    public long? JobId { get; set; }

    /// <summary>DM ra đề.</summary>
    [Column("created_by")]
    public long? CreatedBy { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
