using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class Job : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("job_id")]
    public long JobId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("title")]
    public string Title { get; set; } = null!;
    [Column("jd_text")]
    public string? JdText { get; set; }
    [Column("embedding")]
    public float[]? Embedding { get; set; }
    [Column("department_manager_id")]
    public long? DepartmentManagerId { get; set; }
    [Column("department")]
    public string? Department { get; set; }
    [Column("location")]
    public string? Location { get; set; }
    [Column("employment_type")]
    public string? EmploymentType { get; set; }
    [Column("work_mode")]
    public string? WorkMode { get; set; }
    [Column("experience_level")]
    public string? ExperienceLevel { get; set; }
    [Column("salary_min")]
    public decimal? SalaryMin { get; set; }
    [Column("salary_max")]
    public decimal? SalaryMax { get; set; }
    [Column("currency")]
    public string? Currency { get; set; }
    [Column("deadline")]
    public DateTime? Deadline { get; set; }
    [Column("skill_tags")]
    public string? SkillTags { get; set; }
    [Column("quantity")]
    public int Quantity { get; set; }
    [Column("cv_score_threshold")]
    public decimal? CvScoreThreshold { get; set; }
    [Column("created_by")]
    public long? CreatedBy { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
    [Column("closed_at")]
    public DateTime? ClosedAt { get; set; }
}
