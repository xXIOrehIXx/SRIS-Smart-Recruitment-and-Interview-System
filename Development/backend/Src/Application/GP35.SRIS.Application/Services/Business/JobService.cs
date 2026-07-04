using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
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

    public async Task<IEnumerable<JobGetDto>> GetPublicJobsAsync()
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var jobs = await jobRepo.GetPublicOpenJobsAsync();
        return jobs.Select(ToPublicDto);
    }

    public async Task<JobGetDto?> GetPublicJobAsync(long jobId)
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var job = await jobRepo.GetPublicOpenJobAsync(jobId);
        return job != null ? ToPublicDto(job) : null;
    }

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

    private static JobGetDto ToPublicDto(Job j) => new()
    {
        JobId = j.JobId,
        CompanyId = j.CompanyId,
        Title = j.Title,
        JdText = j.JdText,
        DepartmentManagerId = j.DepartmentManagerId,
        CreatedBy = j.CreatedBy,
        Status = j.Status,
        CreatedAt = j.CreatedAt,
        UpdatedAt = j.UpdatedAt,
        Department = j.Department,
        Location = j.Location,
        EmploymentType = j.EmploymentType,
        Quantity = j.Quantity,
        // Các trường bổ sung mặc định
        Skills = new List<string>(),
        Benefits = new List<string>(),
        Requirements = new List<string>()
    };
}
