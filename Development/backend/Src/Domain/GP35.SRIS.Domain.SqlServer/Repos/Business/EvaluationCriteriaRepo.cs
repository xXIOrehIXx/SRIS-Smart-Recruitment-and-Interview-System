using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class EvaluationCriteriaRepo : BaseRepo<long, EvaluationCriteria>, IEvaluationCriteriaRepo
{
    private readonly SrisDbContext _db;

    public EvaluationCriteriaRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, EvaluationCriteria criteria)
    {
        criteria.CompanyId = companyId;
        _db.EvaluationCriterias.Add(criteria);
        await _db.SaveChangesAsync();
        return criteria.CriteriaId;
    }

    public async Task<IReadOnlyList<EvaluationCriteria>> GetByJobAsync(
        long companyId, long jobId, bool activeOnly, bool approvedOnly = true)
    {
        var q = _db.EvaluationCriterias.AsNoTracking().Where(c => c.JobId == jobId);
        if (activeOnly) q = q.Where(c => c.Active);
        if (approvedOnly) q = q.Where(c => c.Status == CriteriaStatus.Approved);
        return await q.OrderBy(c => c.CriteriaId).ToListAsync();
    }

    public async Task<EvaluationCriteria?> GetByIdAsync(long companyId, long criteriaId)
    {
        return await _db.EvaluationCriterias.AsNoTracking().FirstOrDefaultAsync(c => c.CriteriaId == criteriaId);
    }

    public async Task<int> UpdateAsync(long companyId, long criteriaId, string name, decimal weight,
        decimal maxScore, bool active)
    {
        return await _db.EvaluationCriterias
            .Where(c => c.CriteriaId == criteriaId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Name, name)
                .SetProperty(c => c.Weight, weight)
                .SetProperty(c => c.MaxScore, maxScore)
                .SetProperty(c => c.Active, active)
                .SetProperty(c => c.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<int> DeleteDraftsAsync(long companyId, long jobId)
    {
        return await _db.EvaluationCriterias
            .Where(c => c.JobId == jobId && c.Status == CriteriaStatus.Draft)
            .ExecuteDeleteAsync();
    }

    public async Task<int> DeleteByJobAndNamesAsync(
        long companyId, long jobId, IReadOnlyCollection<string> names)
    {
        if (names is null || names.Count == 0) return 0;

        var nameList = names.Where(n => !string.IsNullOrWhiteSpace(n)).ToList();
        if (nameList.Count == 0) return 0;

        return await _db.EvaluationCriterias
            .Where(c => c.JobId == jobId && nameList.Contains(c.Name))
            .ExecuteDeleteAsync();
    }

    public async Task<int> DeactivateAsync(long companyId, long criteriaId)
    {
        return await _db.EvaluationCriterias
            .Where(c => c.CriteriaId == criteriaId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Active, false)
                .SetProperty(c => c.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId)
    {
        return await _db.EvaluationCriterias
            .Where(c => c.JobId == jobId && c.Status == CriteriaStatus.Draft)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, CriteriaStatus.Approved)
                .SetProperty(c => c.ApprovedBy, userId)
                .SetProperty(c => c.ApprovedAt, DateTime.UtcNow)
                .SetProperty(c => c.UpdatedAt, DateTime.UtcNow));
    }
}
