using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.CareerSite;
using GP35.SRIS.Application.Contracts.Services.Ai;
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

    private readonly ICompanyRepo _companyRepo;
    private readonly IJobRepo _jobRepo;
    private readonly ICvScoringService _cvScoring;
    private readonly ILogger _logger;

    public CareerSiteService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _companyRepo = serviceProvider.GetRequiredService<ICompanyRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _cvScoring = serviceProvider.GetRequiredService<ICvScoringService>();
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
        return jobs.Where(IsOpen).Select(ToPublicDto).ToList();
    }

    public async Task<PublicJobDto?> GetOpenJobAsync(long companyId, long jobId)
    {
        var job = await _jobRepo.GetByIdAsync(companyId, jobId);
        if (job is null || !IsOpen(job)) return null;
        return ToPublicDto(job);
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

        _logger.Information("CareerSite: ứng viên nộp CV app={AppId} job={JobId} (điểm ẩn với ứng viên).",
            result.ApplicationId, jobId);

        return new PublicApplyResultDto
        {
            ApplicationId = result.ApplicationId ?? 0
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

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
