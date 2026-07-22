using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class DepartmentRepo : BaseRepo<long, Department>, IDepartmentRepo
{
    private readonly SrisDbContext _db;

    public DepartmentRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, Department department)
    {
        department.CompanyId = companyId;
        _db.Departments.Add(department);
        await _db.SaveChangesAsync();
        return department.DepartmentId;
    }

    public async Task<IReadOnlyList<DepartmentRow>> GetListAsync(long companyId)
    {
        // Global Query Filter tự kèm company_id; đếm job đang dùng theo tên (Job lưu tên, không FK).
        return await (
            from d in _db.Departments.AsNoTracking()
            join j in _db.Jobs.AsNoTracking() on d.Name equals j.Department into gj
            orderby d.Name
            select new DepartmentRow(d, gj.Count()))
            .ToListAsync();
    }

    public async Task<Department?> GetByIdAsync(long companyId, long departmentId)
    {
        return await _db.Departments
            .FirstOrDefaultAsync(d => d.DepartmentId == departmentId);
    }

    public async Task<bool> NameExistsAsync(long companyId, string name, long? exceptId = null)
    {
        // So sánh tên theo collation DB (case-insensitive) — khớp UNIQUE (company_id, name).
        return await _db.Departments
            .AnyAsync(d => d.Name == name && (exceptId == null || d.DepartmentId != exceptId));
    }

    public async Task<int> CountJobsUsingAsync(long companyId, string name)
    {
        return await _db.Jobs.CountAsync(j => j.Department == name);
    }

    public async Task RenameReferencesAsync(long companyId, string oldName, string newName)
    {
        await _db.Jobs
            .Where(j => j.Department == oldName)
            .ExecuteUpdateAsync(s => s.SetProperty(j => j.Department, newName));
        await _db.RecruitmentRequests
            .Where(r => r.Department == oldName)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.Department, newName));
    }

    public async Task DeleteAsync(Department department)
    {
        _db.Departments.Remove(department);
        await _db.SaveChangesAsync();
    }

    public Task SaveAsync() => _db.SaveChangesAsync();
}
