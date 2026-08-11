using System.Text.Json;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class JobRepo : BaseRepo<long, Job>, IJobRepo
{
    private readonly SrisDbContext _db;

    public JobRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, Job job)
    {
        job.CompanyId = companyId;
        _db.Jobs.Add(job);
        await _db.SaveChangesAsync();
        return job.JobId; // EF đọc lại khóa IDENTITY + created_at (store-generated) sau khi lưu
    }

    public async Task<IEnumerable<Job>> GetListByCompanyAsync(long companyId)
    {
        // Global Query Filter tự kèm company_id; AsNoTracking cho truy vấn đọc.
        return await _db.Jobs
            .AsNoTracking()
            .OrderByDescending(j => j.JobId)
            .ToListAsync();
    }

    public async Task<Job?> GetByIdAsync(long companyId, long jobId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.Jobs.AsNoTracking().FirstOrDefaultAsync(j => j.JobId == jobId);
    }

    public async Task<int> UpdateAsync(long companyId, long jobId, string title, string? jdText,
        long? departmentManagerId, string status)
    {
        return await _db.Jobs
            .Where(j => j.JobId == jobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.Title, title)
                .SetProperty(j => j.JdText, jdText)
                .SetProperty(j => j.DepartmentManagerId, departmentManagerId)
                .SetProperty(j => j.Status, status)
                .SetProperty(j => j.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<int> UpdateExtendedAsync(long companyId, long jobId, Job job)
    {
        return await _db.Jobs
            .Where(j => j.JobId == jobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.Title, job.Title)
                .SetProperty(j => j.JdText, job.JdText)
                .SetProperty(j => j.DepartmentManagerId, job.DepartmentManagerId)
                .SetProperty(j => j.Department, job.Department)
                .SetProperty(j => j.Location, job.Location)
                .SetProperty(j => j.EmploymentType, job.EmploymentType)
                .SetProperty(j => j.WorkMode, job.WorkMode)
                .SetProperty(j => j.ExperienceLevel, job.ExperienceLevel)
                .SetProperty(j => j.SalaryMin, job.SalaryMin)
                .SetProperty(j => j.SalaryMax, job.SalaryMax)
                .SetProperty(j => j.Currency, job.Currency)
                .SetProperty(j => j.Deadline, job.Deadline)
                .SetProperty(j => j.SkillTags, job.SkillTags)
                .SetProperty(j => j.Quantity, job.Quantity)
                .SetProperty(j => j.Status, job.Status)
                .SetProperty(j => j.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<IEnumerable<Job>> GetPublicOpenJobsAsync()
    {
        // Public endpoint: bỏ qua global query filter company_id
        return await _db.Jobs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .OrderByDescending(j => j.CreatedAt)
            .ToListAsync();
    }

    public async Task<Job?> GetPublicOpenJobAsync(long jobId)
    {
        // Public endpoint: bỏ qua global query filter company_id
        return await _db.Jobs
            .IgnoreQueryFilters()
            .AsNoTracking()
            .Where(j => j.JobId == jobId && j.Status == "Open")
            .FirstOrDefaultAsync();
    }

    /* ===== V020 ===== */

    public async Task<IReadOnlyList<JobRequirement>> GetRequirementsAsync(long companyId, long jobId)
    {
        return await _db.JobRequirements
            .AsNoTracking()
            .Where(r => r.JobId == jobId)
            .OrderBy(r => r.Ordinal)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<JobBenefit>> GetBenefitsAsync(long companyId, long jobId)
    {
        return await _db.JobBenefits
            .AsNoTracking()
            .Where(b => b.JobId == jobId)
            .OrderBy(b => b.Ordinal)
            .ToListAsync();
    }

    public async Task ReplaceRequirementsAsync(long companyId, long jobId, IReadOnlyList<string> contents)
    {
        // Xóa cũ: IgnoreQueryFilters vì RLS ẩn dòng khi SESSION_CONTEXT('CompanyId') chưa set
        // đúng ở DbContext scope hiện tại (caller đã có company_id nhưng EF context tạo sẵn
        // có thể đang _companyId = 0). An toàn vì đã lọc theo jobId ở WHERE.
        await _db.JobRequirements
            .IgnoreQueryFilters()
            .Where(r => r.JobId == jobId)
            .ExecuteDeleteAsync();

        for (int i = 0; i < contents.Count; i++)
        {
            var c = contents[i];
            if (string.IsNullOrWhiteSpace(c)) continue;
            var trimmed = c.Trim();
            // NVARCHAR(500) -> clamp để không 500 vì DB sẽ tự reject nếu vượt quá.
            if (trimmed.Length > 500) trimmed = trimmed[..500];
            _db.JobRequirements.Add(new JobRequirement
            {
                CompanyId = companyId,
                JobId = jobId,
                Ordinal = i + 1,
                Content = trimmed
            });
        }
        if (_db.JobRequirements.Local.Count > 0)
            await _db.SaveChangesAsync();
    }

    public async Task ReplaceBenefitsAsync(long companyId, long jobId, IReadOnlyList<string> contents)
    {
        await _db.JobBenefits
            .IgnoreQueryFilters()
            .Where(b => b.JobId == jobId)
            .ExecuteDeleteAsync();

        for (int i = 0; i < contents.Count; i++)
        {
            var c = contents[i];
            if (string.IsNullOrWhiteSpace(c)) continue;
            var trimmed = c.Trim();
            if (trimmed.Length > 500) trimmed = trimmed[..500];
            _db.JobBenefits.Add(new JobBenefit
            {
                CompanyId = companyId,
                JobId = jobId,
                Ordinal = i + 1,
                Content = trimmed
            });
        }
        if (_db.JobBenefits.Local.Count > 0)
            await _db.SaveChangesAsync();
    }

    public async Task<IReadOnlyList<ExpiredJobRef>> GetExpiredOpenJobsAsync(CancellationToken ct = default)
    {
        // Raw SQL bypass RLS — worker JobExpiry cần nhìn xuyên tenant (không có request HTTP
        // để set SESSION_CONTEXT). Job trong bảng Job có company_id; đóng job từng cái bằng
        // UpdateAsync thông thường sau khi worker tự set IContextData.CompanyId.
        var rows = await _db.Database
            .SqlQueryRaw<ExpiredJobRow>(
                "SELECT company_id AS CompanyId, job_id AS JobId, title AS Title, deadline AS Deadline " +
                "FROM dbo.Job " +
                "WHERE status = 'Open' AND deadline IS NOT NULL AND deadline < CAST(SYSUTCDATETIME() AS DATE)")
            .ToListAsync(ct);
        return rows.Select(r => new ExpiredJobRef(r.CompanyId, r.JobId, r.Title, r.Deadline)).ToList();
    }

    /// <summary>
    /// Wrapper riêng cho SqlQueryRaw — không thể dùng record <see cref="ExpiredJobRef"/> vì
    /// property-name trong SQL phải khớp tên cột thuần (EF map theo PropertyInfo + value converter).
    /// </summary>
    private class ExpiredJobRow
    {
        public long CompanyId { get; set; }
        public long JobId { get; set; }
        public string Title { get; set; } = string.Empty;
        public DateTime Deadline { get; set; }
    }
}
