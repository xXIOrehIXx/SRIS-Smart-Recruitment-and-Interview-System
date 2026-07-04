using System.Net;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services;

public class JobService : BaseService<JobService>, IJobService
{
    public JobService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
    }

    public async Task<JobGetDto> CreateAsync(long companyId, long createdBy, JobCreateDto dto)
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();

        var job = new Job
        {
            Title = dto.Title.Trim(),
            JdText = dto.JdText,
            DepartmentManagerId = dto.DepartmentManagerId,
            CreatedBy = createdBy,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Open" : dto.Status.Trim()
        };

        // InsertAsync set company_id, lưu rồi đọc lại job_id (IDENTITY) + created_at (store-generated).
        await jobRepo.InsertAsync(companyId, job);

        return ToDto(job);
    }

    public async Task<IEnumerable<JobGetDto>> GetListAsync(long companyId)
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var jobs = await jobRepo.GetListByCompanyAsync(companyId);
        return jobs.Select(ToDto);
    }

    public async Task<JobGetDto> GetByIdAsync(long companyId, long jobId)
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var job = await jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (job_id={jobId}).");
        return ToDto(job);
    }

    public async Task<JobGetDto> UpdateAsync(long companyId, long jobId, JobUpdateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            throw Bad("Tiêu đề Job không được để trống.");
        var status = string.IsNullOrWhiteSpace(dto.Status) ? "Open" : dto.Status.Trim();

        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var existing = await jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (job_id={jobId}).");

        var jdChanged = !string.Equals(existing.JdText ?? "", dto.JdText ?? "", StringComparison.Ordinal);
        await jobRepo.UpdateAsync(companyId, jobId, dto.Title.Trim(), dto.JdText,
            dto.DepartmentManagerId, status, jdChanged);

        var updated = await jobRepo.GetByIdAsync(companyId, jobId);
        return ToDto(updated!);
    }

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static JobGetDto ToDto(Job j) => new()
    {
        JobId = j.JobId,
        CompanyId = j.CompanyId,
        Title = j.Title,
        JdText = j.JdText,
        DepartmentManagerId = j.DepartmentManagerId,
        CreatedBy = j.CreatedBy,
        Status = j.Status,
        CreatedAt = j.CreatedAt,
        UpdatedAt = j.UpdatedAt
    };
}
