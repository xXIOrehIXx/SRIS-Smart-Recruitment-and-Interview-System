using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
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

    public async Task<IReadOnlyList<ActivityLogRow>> GetByApplicationAsync(long companyId, long applicationId)
    {
        // Join User lấy email người thực hiện (user_id null = hệ thống/ứng viên qua magic link).
        // Theo thứ tự thời gian (log_id tăng dần) — đọc như 1 timeline.
        return await (
            from l in _db.ActivityLogs.AsNoTracking()
            join u in _db.Users.AsNoTracking() on l.UserId equals u.UserId into uj
            from u in uj.DefaultIfEmpty()
            where l.ApplicationId == applicationId
            orderby l.LogId
            select new ActivityLogRow(
                l.LogId, l.UserId, u != null ? u.Email : null, l.Action,
                l.FromState, l.ToState, l.Detail, l.CreatedAt))
            .ToListAsync();
    }
}
