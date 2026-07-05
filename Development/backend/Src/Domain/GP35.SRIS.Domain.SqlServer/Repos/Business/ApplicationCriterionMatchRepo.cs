using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class ApplicationCriterionMatchRepo : BaseRepo<long, ApplicationCriterionMatch>, IApplicationCriterionMatchRepo
{
    private readonly SrisDbContext _db;

    public ApplicationCriterionMatchRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task ReplaceForApplicationAsync(
        long companyId, long applicationId, IReadOnlyList<ApplicationCriterionMatch> matches)
    {
        await _db.ApplicationCriterionMatches
            .Where(m => m.ApplicationId == applicationId)
            .ExecuteDeleteAsync();

        foreach (var m in matches)
        {
            m.CompanyId = companyId;
            m.ApplicationId = applicationId;
        }
        _db.ApplicationCriterionMatches.AddRange(matches);
        await _db.SaveChangesAsync();
    }

    public async Task<IReadOnlyList<CriterionMatchRow>> GetByApplicationAsync(long companyId, long applicationId)
    {
        return await (
            from m in _db.ApplicationCriterionMatches.AsNoTracking()
            join c in _db.EvaluationCriterias.AsNoTracking() on m.CriteriaId equals c.CriteriaId
            where m.ApplicationId == applicationId
            orderby c.CriteriaType, c.CriteriaId // HARD trước, rồi SOFT — người đọc thấy điều kiện cứng đầu tiên
            select new CriterionMatchRow(
                c.CriteriaId, c.Name, c.CriteriaType, c.CvMatchable,
                c.Weight, m.Matched, m.Similarity, m.Evidence, m.EvaluatedAt))
            .ToListAsync();
    }
}
