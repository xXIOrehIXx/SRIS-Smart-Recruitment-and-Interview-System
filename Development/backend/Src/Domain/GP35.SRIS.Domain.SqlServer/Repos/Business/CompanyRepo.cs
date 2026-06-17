using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CompanyRepo : BaseRepo<long, Company>, ICompanyRepo
{
    private readonly SrisDbContext _db;

    public CompanyRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<Company> GetByCompanyId(long companyId)
    {
        // Cô lập tenant do RLS (SESSION_CONTEXT) + WHERE tường minh.
        return await _db.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.CompanyId == companyId);
    }
}
