namespace GP35.SRIS.Application.Contracts.Dtos.CareerSite;

/// <summary>Thông tin brand công khai để Career Site render (logo + màu). Không lộ cấu hình nội bộ.</summary>
public class PublicBrandDto
{
    public long CompanyId { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string? LogoUrl { get; set; }
    public string? PrimaryColor { get; set; }
}

/// <summary>Job hiển thị công khai trên Career Site (chỉ field an toàn — không lộ embedding/nội bộ). V020: mở rộng.</summary>
public class PublicJobDto
{
    public long JobId { get; set; }
    public string Title { get; set; } = null!;
    public string? JdText { get; set; }
    public string Status { get; set; } = null!;
    public DateTime? CreatedAt { get; set; }
    public string? Department { get; set; }
    public string? Location { get; set; }
    public string? EmploymentType { get; set; }
    public string? WorkMode { get; set; }
    public string? ExperienceLevel { get; set; }
    public decimal? SalaryMin { get; set; }
    public decimal? SalaryMax { get; set; }
    public DateTime? Deadline { get; set; }
    public List<string>? Skills { get; set; }
    public List<string>? Benefits { get; set; }
    public List<string>? Requirements { get; set; }
}

/// <summary>
/// Kết quả nộp CV của ứng viên trên Career Site. KHÔNG trả điểm AI (điểm chấm CV là dữ liệu nội bộ
/// của Recruiter — docs 5.7); chỉ xác nhận đã nhận hồ sơ.
/// </summary>
public class PublicApplyResultDto
{
    public long ApplicationId { get; set; }
    public string Message { get; set; } = "Đã nhận hồ sơ của bạn. Cảm ơn bạn đã ứng tuyển!";
}
