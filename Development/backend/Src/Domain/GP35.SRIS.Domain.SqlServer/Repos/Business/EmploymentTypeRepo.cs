using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class EmploymentTypeRepo : BaseRepo<long, EmploymentType>, IEmploymentTypeRepo
{
    private readonly SrisDbContext _db;

    public EmploymentTypeRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, EmploymentType employmentType)
    {
        employmentType.CompanyId = companyId;
        _db.EmploymentTypes.Add(employmentType);
        await _db.SaveChangesAsync();
        return employmentType.EmploymentTypeId;
    }

    public async Task<IReadOnlyList<EmploymentTypeRow>> GetListAsync(long companyId)
    {
        // Global Query Filter tự kèm company_id; đếm job đang dùng theo tên (Job lưu tên, không FK).
        return await (
            from t in _db.EmploymentTypes.AsNoTracking()
            join j in _db.Jobs.AsNoTracking() on t.Name equals j.EmploymentType into gj
            orderby t.Name
            select new EmploymentTypeRow(t, gj.Count()))
            .ToListAsync();
    }

    public async Task<EmploymentType?> GetByIdAsync(long companyId, long employmentTypeId)
    {
        return await _db.EmploymentTypes
            .FirstOrDefaultAsync(t => t.EmploymentTypeId == employmentTypeId);
    }

    public async Task<bool> NameExistsAsync(long companyId, string name, long? exceptId = null)
    {
        // So sánh tên theo collation DB (case-insensitive) — khớp UNIQUE (company_id, name).
        return await _db.EmploymentTypes
            .AnyAsync(t => t.Name == name && (exceptId == null || t.EmploymentTypeId != exceptId));
    }

    public async Task<int> CountJobsUsingAsync(long companyId, string name)
    {
        return await _db.Jobs.CountAsync(j => j.EmploymentType == name);
    }

    public async Task RenameReferencesAsync(long companyId, string oldName, string newName)
    {
        await _db.Jobs
            .Where(j => j.EmploymentType == oldName)
            .ExecuteUpdateAsync(s => s.SetProperty(j => j.EmploymentType, newName));
        await _db.RecruitmentRequests
            .Where(r => r.EmploymentType == oldName)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.EmploymentType, newName));
    }

    public async Task DeleteAsync(EmploymentType employmentType)
    {
        _db.EmploymentTypes.Remove(employmentType);
        await _db.SaveChangesAsync();
    }

    public Task SaveAsync() => _db.SaveChangesAsync();
}
