using System.Net;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services;

public class JobService : BaseService<JobService>, IJobService
{
    public JobService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
    }

    public async Task<JobGetDto> CreateAsync(long companyId, long createdBy, JobCreateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            throw Bad("Tiêu đề Job không được để trống.");
        ValidateDeadline(dto.Deadline);

        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();

        var job = new Job
        {
            Title = dto.Title.Trim(),
            JdText = dto.JdText,
            DepartmentManagerId = await ResolveDepartmentManagerAsync(companyId, dto.Department, dto.DepartmentManagerId),
            CreatedBy = createdBy,
            Department = dto.Department,
            Location = dto.Location,
            EmploymentType = dto.EmploymentType,
            WorkMode = dto.WorkMode,
            ExperienceLevel = dto.ExperienceLevel,
            SalaryMin = dto.SalaryMin,
            SalaryMax = dto.SalaryMax,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "VND" : dto.Currency,
            Deadline = dto.Deadline,
            Status = string.IsNullOrWhiteSpace(dto.Status) ? "Open" : dto.Status.Trim()
        };

        // InsertAsync set company_id, lưu rồi đọc lại job_id (IDENTITY) + created_at (store-generated).
        await jobRepo.InsertAsync(companyId, job);

        // V020: lưu requirements + benefits (bảng 1-N). Mỗi cái chạy trong transaction riêng —
        // nếu 1 cái fail, cái kia vẫn commit; vẫn an toàn vì job đã được tạo.
        if (dto.Requirements is { Count: > 0 } && dto.Requirements.Any(r => !string.IsNullOrWhiteSpace(r)))
        {
            try { await jobRepo.ReplaceRequirementsAsync(companyId, job.JobId, dto.Requirements); }
            catch (Exception ex) { Serilog.Log.Warning(ex, "ReplaceRequirementsAsync fail (job_id={JobId}): {Msg}", job.JobId, ex.Message); }
        }
        if (dto.Benefits is { Count: > 0 } && dto.Benefits.Any(b => !string.IsNullOrWhiteSpace(b)))
        {
            try { await jobRepo.ReplaceBenefitsAsync(companyId, job.JobId, dto.Benefits); }
            catch (Exception ex) { Serilog.Log.Warning(ex, "ReplaceBenefitsAsync fail (job_id={JobId}): {Msg}", job.JobId, ex.Message); }
        }

        return await ToDtoAsync(jobRepo, companyId, job.JobId);
    }

    public async Task<IEnumerable<JobGetDto>> GetListAsync(long companyId)
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var jobs = await jobRepo.GetListByCompanyAsync(companyId);
        var result = new List<JobGetDto>(jobs.Count());
        foreach (var j in jobs)
            result.Add(await ToDtoAsync(jobRepo, companyId, j.JobId, fallbackJob: j));
        return result;
    }

    public async Task<JobGetDto> GetByIdAsync(long companyId, long jobId)
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var job = await jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (job_id={jobId}).");
        return await ToDtoAsync(jobRepo, companyId, jobId, fallbackJob: job);
    }

    public async Task<JobGetDto> UpdateAsync(long companyId, long jobId, JobUpdateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            throw Bad("Tiêu đề Job không được để trống.");
        var status = string.IsNullOrWhiteSpace(dto.Status) ? "Open" : dto.Status.Trim();

        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var existing = await jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (job_id={jobId}).");

        // Chỉ kiểm hạn nộp khi người dùng ĐỔI nó: tin cũ đã quá hạn vẫn phải sửa được
        // (đóng tin, đổi mô tả...) mà không bị chặn vì cái hạn có sẵn.
        if (dto.Deadline != existing.Deadline)
            ValidateDeadline(dto.Deadline);

        var jdChanged = !string.Equals(existing.JdText ?? "", dto.JdText ?? "", StringComparison.Ordinal);

        var updatedJob = new Job
        {
            Title = dto.Title.Trim(),
            JdText = dto.JdText,
            DepartmentManagerId = await ResolveDepartmentManagerAsync(companyId, dto.Department, dto.DepartmentManagerId),
            Department = dto.Department,
            Location = dto.Location,
            EmploymentType = dto.EmploymentType,
            WorkMode = dto.WorkMode,
            ExperienceLevel = dto.ExperienceLevel,
            SalaryMin = dto.SalaryMin,
            SalaryMax = dto.SalaryMax,
            Currency = dto.Currency,
            Deadline = dto.Deadline,
            Status = status
        };

        await jobRepo.UpdateExtendedAsync(companyId, jobId, updatedJob, jdChanged);

        if (dto.Requirements is not null)
            await jobRepo.ReplaceRequirementsAsync(companyId, jobId, dto.Requirements);
        if (dto.Benefits is not null)
            await jobRepo.ReplaceBenefitsAsync(companyId, jobId, dto.Benefits);

        return await ToDtoAsync(jobRepo, companyId, jobId);
    }

    public async Task CloseAsync(long companyId, long jobId)
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var job = await jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (job_id={jobId}).");
        // Soft close — giữ hồ sơ + analytics; không đổi JD nên không đụng embedding.
        await jobRepo.UpdateAsync(companyId, jobId, job.Title, job.JdText,
            job.DepartmentManagerId, "Closed", jdChanged: false);
    }

    /// <summary>
    /// Người quyết tuyển của job (V023): Human Resource chọn tay thì tôn trọng lựa chọn đó; bỏ trống
    /// thì lấy DM phụ trách phòng ban đã chọn. Phòng ban chưa gán DM -> vẫn null (Human Resource quyết,
    /// đường mặc định của công ty nhỏ).
    /// </summary>
    private async Task<long?> ResolveDepartmentManagerAsync(long companyId, string? department, long? explicitManagerId)
    {
        if (explicitManagerId is > 0) return explicitManagerId;
        if (string.IsNullOrWhiteSpace(department)) return null;

        var departmentRepo = _serviceProvider.GetRequiredService<IDepartmentRepo>();
        var managerId = await departmentRepo.GetManagerByNameAsync(companyId, department.Trim());
        if (managerId is > 0)
            Serilog.Log.Information("Job: tự gán DM {ManagerId} theo phòng ban '{Department}'.", managerId, department);
        return managerId;
    }

    /// <summary>
    /// Hạn nộp đơn không được ở quá khứ — tin đăng ra là đã hết hạn thì ứng viên không nộp
    /// được, mà FE lại không chặn nên lỗi này chỉ lộ ra khi có người thật vào ứng tuyển.
    /// So ở mức NGÀY (hạn nộp là ngày, không có giờ).
    /// </summary>
    private static void ValidateDeadline(DateTime? deadline)
    {
        if (deadline is { } d && d.Date < DateTime.UtcNow.Date)
            throw Bad($"Hạn nộp đơn ({d:dd/MM/yyyy}) đã ở quá khứ — chọn ngày từ hôm nay trở đi.");
    }

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    public async Task<IEnumerable<JobGetDto>> GetPublicJobsAsync()
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var jobs = await jobRepo.GetPublicOpenJobsAsync();
        var result = new List<JobGetDto>();
        foreach (var j in jobs)
            result.Add(await ToDtoAsync(jobRepo, 0, j.JobId, fallbackJob: j, isPublic: true));
        return result;
    }

    public async Task<JobGetDto?> GetPublicJobAsync(long jobId)
    {
        var jobRepo = _serviceProvider.GetRequiredService<IJobRepo>();
        var job = await jobRepo.GetPublicOpenJobAsync(jobId);
        return job is null ? null : await ToDtoAsync(jobRepo, 0, jobId, fallbackJob: job, isPublic: true);
    }

    /// <summary>
    /// Map Job -> JobGetDto kèm requirements/benefits. Với public + Job.Open sẽ chỉ trả field public.
    /// </summary>
    private static async Task<JobGetDto> ToDtoAsync(IJobRepo jobRepo, long companyId, long jobId,
        Job? fallbackJob = null, bool isPublic = false)
    {
        Job? job = fallbackJob ?? await jobRepo.GetByIdAsync(companyId, jobId);
        if (job is null)
            return new JobGetDto { JobId = jobId, Title = "(unknown)", Status = "Unknown" };

        IReadOnlyList<JobRequirement> requirements = Array.Empty<JobRequirement>();
        IReadOnlyList<JobBenefit> benefits = Array.Empty<JobBenefit>();
        try
        {
            requirements = await jobRepo.GetRequirementsAsync(companyId, jobId);
            benefits = await jobRepo.GetBenefitsAsync(companyId, jobId);
        }
        catch
        {
            // bảng V020 có thể chưa tồn tại trên môi trường chưa migrate -> trả rỗng, không crash.
        }

        return new JobGetDto
        {
            JobId = job.JobId,
            CompanyId = job.CompanyId,
            Title = job.Title,
            JdText = job.JdText,
            DepartmentManagerId = job.DepartmentManagerId,
            CreatedBy = job.CreatedBy,
            Status = job.Status,
            CreatedAt = job.CreatedAt,
            UpdatedAt = job.UpdatedAt,
            Department = job.Department,
            Location = job.Location,
            EmploymentType = job.EmploymentType,
            WorkMode = job.WorkMode,
            ExperienceLevel = job.ExperienceLevel,
            SalaryMin = job.SalaryMin,
            SalaryMax = job.SalaryMax,
            Salary = FormatSalary(job),
            Currency = job.Currency,
            Deadline = job.Deadline,
            Requirements = requirements.Select(r => r.Content).ToList(),
            Benefits = benefits.Select(b => b.Content).ToList(),
            Skills = string.IsNullOrWhiteSpace(job.SkillTags)
                ? new List<string>()
                : job.SkillTags!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList()
        };
    }

    private static string? FormatSalary(Job j)
    {
        if (j.SalaryMin is null && j.SalaryMax is null) return null;
        string n0(decimal n) => string.Format(System.Globalization.CultureInfo.GetCultureInfo("vi-VN"), "{0:N0}", n);
        if (j.SalaryMin is not null && j.SalaryMax is not null)
            return $"{n0(j.SalaryMin.Value)} - {n0(j.SalaryMax.Value)} {j.Currency ?? "VND"}";
        return $"{n0((j.SalaryMin ?? j.SalaryMax)!.Value)} {j.Currency ?? "VND"}";
    }
}
