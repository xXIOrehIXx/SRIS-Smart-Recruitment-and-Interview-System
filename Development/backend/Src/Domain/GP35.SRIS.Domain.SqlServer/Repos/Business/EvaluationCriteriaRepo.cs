using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
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

    public async Task<IReadOnlyList<EvaluationCriteria>> GetByJobAsync(long companyId, long jobId, bool activeOnly)
    {
        var q = _db.EvaluationCriterias.AsNoTracking().Where(c => c.JobId == jobId);
        if (activeOnly) q = q.Where(c => c.Active);
        return await q.OrderBy(c => c.CriteriaId).ToListAsync();
    }

    public async Task<EvaluationCriteria?> GetByIdAsync(long companyId, long criteriaId)
    {
        return await _db.EvaluationCriterias.AsNoTracking().FirstOrDefaultAsync(c => c.CriteriaId == criteriaId);
    }

    public async Task<int> UpdateAsync(
        long companyId, long criteriaId, string name, decimal weight, decimal maxScore, bool active)
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
}
