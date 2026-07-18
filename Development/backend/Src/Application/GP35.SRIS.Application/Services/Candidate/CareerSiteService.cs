using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.CareerSite;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.CandidatePortal;

/// <summary>
/// Career Site công khai (M1). Đọc job/brand đã bị giới hạn theo tenant (Global Query Filter + RLS,
/// companyId set ở middleware từ slug). Nộp CV tái dùng <see cref="ICvScoringService"/> nhưng KHÔNG
/// trả điểm AI cho ứng viên (điểm là dữ liệu nội bộ — docs 5.7).
/// </summary>
public class CareerSiteService : BaseService<CareerSiteService>, ICareerSiteService
{
    private const string OpenStatus = "Open";
    private const string StatusPurpose = "STATUS";
    private const int StatusLinkTtlDays = 30;

    private readonly ICompanyRepo _companyRepo;
    private readonly IJobRepo _jobRepo;
    private readonly ICvScoringService _cvScoring;
    private readonly IMagicLinkService _magicLink;
    private readonly INotificationService _notification;
    private readonly ILogger _logger;

    public CareerSiteService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _companyRepo = serviceProvider.GetRequiredService<ICompanyRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _cvScoring = serviceProvider.GetRequiredService<ICvScoringService>();
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _notification = serviceProvider.GetRequiredService<INotificationService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CareerSiteService>();
    }

    public async Task<PublicBrandDto?> GetBrandAsync(long companyId)
    {
        var company = await _companyRepo.GetByCompanyId(companyId);
        if (company is null) return null;

        return new PublicBrandDto
        {
            CompanyId = company.CompanyId,
            Name = company.Name,
            Slug = company.Slug,
            LogoUrl = company.LogoUrl,
            PrimaryColor = company.PrimaryColor
        };
    }

    public async Task<IEnumerable<PublicJobDto>> ListOpenJobsAsync(long companyId)
    {
        var jobs = await _jobRepo.GetListByCompanyAsync(companyId);
        var result = new List<PublicJobDto>();
        foreach (var j in jobs.Where(IsOpen))
        {
            var dto = await ToPublicDtoAsync(companyId, j);
            result.Add(dto);
        }
        return result;
    }

    public async Task<PublicJobDto?> GetOpenJobAsync(long companyId, long jobId)
    {
        var job = await _jobRepo.GetByIdAsync(companyId, jobId);
        if (job is null || !IsOpen(job)) return null;
        return await ToPublicDtoAsync(companyId, job);
    }

    public async Task<PublicApplyResultDto> ApplyAsync(
        long companyId, long jobId, string candidateName, string candidateEmail, string candidatePhone,
        string fileName, string? mimeType, byte[] fileBytes)
    {
        if (string.IsNullOrWhiteSpace(candidateName))
            throw Bad("Vui lòng nhập họ tên.");
        if (string.IsNullOrWhiteSpace(candidateEmail))
            throw Bad("Vui lòng nhập email.");
        if (string.IsNullOrWhiteSpace(candidatePhone))
            throw Bad("Vui lòng nhập số điện thoại.");

        // Chỉ cho nộp vào job đang mở (kiểm theo tenant hiện tại).
        var job = await _jobRepo.GetByIdAsync(companyId, jobId);
        if (job is null || !IsOpen(job))
            throw NotFound("Vị trí tuyển dụng không tồn tại hoặc đã đóng.");

        var result = await _cvScoring.ScoreUploadedCvAsync(
            companyId, jobId, candidateName.Trim(), candidateEmail.Trim(), candidatePhone.Trim(),
            fileName, mimeType, fileBytes);

        if (string.Equals(result.Status, "FAILED", StringComparison.OrdinalIgnoreCase))
            throw Bad(result.Reason
                ?? "Không đọc được nội dung CV (có thể là PDF scan ảnh). Vui lòng nộp PDF có chữ.");

        var applicationId = result.ApplicationId ?? 0;

        // Phát magic link STATUS để ứng viên theo dõi trạng thái
        try
        {
            var issued = await _magicLink.IssueAsync(companyId, applicationId, StatusPurpose, TimeSpan.FromDays(StatusLinkTtlDays));
            // Gửi email xác nhận kèm link xem trạng thái
            await _notification.SendMagicLinkAsync(companyId, applicationId, StatusPurpose, issued.RawToken, issued.ExpiresAt);
        }
        catch (Exception ex)
        {
            // Best-effort: lỗi gửi mail không ảnh hưởng đến việc nộp đơn
            _logger.Warning(ex, "CareerSite: không gửi được email xác nhận cho app={AppId}", applicationId);
        }

        _logger.Information("CareerSite: ứng viên nộp CV app={AppId} job={JobId} (điểm ẩn với ứng viên).",
            applicationId, jobId);

        return new PublicApplyResultDto
        {
            ApplicationId = applicationId
        };
    }

    private static bool IsOpen(Job j) =>
        string.Equals(j.Status, OpenStatus, StringComparison.OrdinalIgnoreCase);

    private static PublicJobDto ToPublicDto(Job j) => new()
    {
        JobId = j.JobId,
        Title = j.Title,
        JdText = j.JdText,
        Status = j.Status,
        CreatedAt = j.CreatedAt
    };

    /// <summary>V020: build public DTO kèm requirements/benefits (chỉ field an toàn).</summary>
    private async Task<PublicJobDto> ToPublicDtoAsync(long companyId, Job j)
    {
        List<string> requirements = new();
        List<string> benefits = new();
        try
        {
            var reqs = await _jobRepo.GetRequirementsAsync(companyId, j.JobId);
            requirements = reqs.Select(r => r.Content).ToList();
            var bens = await _jobRepo.GetBenefitsAsync(companyId, j.JobId);
            benefits = bens.Select(b => b.Content).ToList();
        }
        catch
        {
            // bảng V020 có thể chưa tồn tại ở môi trường chưa migrate -> bỏ qua, không crash.
        }

        return new PublicJobDto
        {
            JobId = j.JobId,
            Title = j.Title,
            JdText = j.JdText,
            Status = j.Status,
            CreatedAt = j.CreatedAt,
            Department = j.Department,
            Location = j.Location,
            EmploymentType = j.EmploymentType,
            WorkMode = j.WorkMode,
            ExperienceLevel = j.ExperienceLevel,
            SalaryMin = j.SalaryMin,
            SalaryMax = j.SalaryMax,
            Deadline = j.Deadline,
            Requirements = requirements,
            Benefits = benefits,
            Skills = string.IsNullOrWhiteSpace(j.SkillTags)
                ? new List<string>()
                : j.SkillTags!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList()
        };
    }

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
