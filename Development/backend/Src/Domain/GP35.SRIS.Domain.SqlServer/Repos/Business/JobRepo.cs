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

    public async Task<JobEmbeddingInfo?> GetEmbeddingInfoAsync(long companyId, long jobId)
    {
        // jd_text lấy qua LINQ (Global Query Filter tự kèm company_id).
        var job = await _db.Jobs
            .AsNoTracking()
            .Where(j => j.JobId == jobId)
            .Select(j => new { j.JobId, j.JdText })
            .FirstOrDefaultAsync();

        if (job is null)
            return null;

        // Cờ "đã có embedding chưa": cột VECTOR không map được nên hỏi bằng raw SQL.
        var hasEmbedding = await _db.Database
            .SqlQueryRaw<int>(
                "SELECT CAST(CASE WHEN embedding IS NULL THEN 0 ELSE 1 END AS INT) AS Value " +
                "FROM Job WHERE job_id = {0} AND company_id = {1}",
                jobId, companyId)
            .SingleAsync();

        return new JobEmbeddingInfo(job.JobId, job.JdText, hasEmbedding == 1);
    }

    public async Task<int> UpdateAsync(long companyId, long jobId, string title, string? jdText,
        long? departmentManagerId, string status, bool jdChanged)
    {
        var rows = await _db.Jobs
            .Where(j => j.JobId == jobId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.Title, title)
                .SetProperty(j => j.JdText, jdText)
                .SetProperty(j => j.DepartmentManagerId, departmentManagerId)
                .SetProperty(j => j.Status, status)
                .SetProperty(j => j.UpdatedAt, DateTime.UtcNow));

        if (rows > 0 && jdChanged)
        {
            // JD đổi -> vector cũ vô nghĩa; NULL để lần chấm sau lazy embed lại.
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE Job SET embedding = NULL WHERE job_id = {0} AND company_id = {1}",
                jobId, companyId);
        }
        return rows;
    }

    public async Task UpdateEmbeddingAsync(long companyId, long jobId, float[] embedding)
    {
        // CAST chuỗi JSON -> VECTOR(1024) ở phía SQL Server (cửa thoát raw SQL — 5.11).
        var vectorJson = JsonSerializer.Serialize(embedding);
        await _db.Database.ExecuteSqlRawAsync(
            "UPDATE Job SET embedding = CAST({0} AS VECTOR(1024)), updated_at = SYSUTCDATETIME() " +
            "WHERE company_id = {1} AND job_id = {2}",
            vectorJson, companyId, jobId);
    }

    public async Task<int> UpdateExtendedAsync(long companyId, long jobId, Job job, bool jdChanged)
    {
        // EF Core ExecuteUpdate không cho NULL-safe từng cột trong 1 lệnh, nên tách 2 nhịp:
        // nhịp 1 update đầy đủ các cột non-null, nhịp 2 set NULL cho cột nullable nếu DTO thiếu.
        var rows = await _db.Jobs
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
                .SetProperty(j => j.Status, job.Status)
                .SetProperty(j => j.UpdatedAt, DateTime.UtcNow));

        if (rows > 0 && jdChanged)
        {
            await _db.Database.ExecuteSqlRawAsync(
                "UPDATE Job SET embedding = NULL WHERE job_id = {0} AND company_id = {1}",
                jobId, companyId);
        }
        return rows;
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
}
