using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class ActivityLogRepo : BaseRepo<long, ActivityLog>, IActivityLogRepo
{
    private readonly SrisDbContext _db;

    public ActivityLogRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task InsertAsync(long companyId, ActivityLog log)
    {
        log.CompanyId = companyId;
        _db.ActivityLogs.Add(log);
        await _db.SaveChangesAsync();
    }
}
