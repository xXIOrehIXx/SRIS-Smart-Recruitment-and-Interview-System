using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

/// <summary>
/// Tổng hợp Dashboard bằng LINQ GroupBy (EF tự kèm company_id qua Global Query Filter — cô lập tenant).
/// jobId null = toàn công ty. AsNoTracking cho mọi truy vấn đọc.
/// </summary>
public class DashboardRepo : IDashboardRepo
{
    private readonly SrisDbContext _db;

    public DashboardRepo(IServiceProvider serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<IReadOnlyList<StateCount>> GetFunnelAsync(long companyId, long? jobId)
    {
        return await _db.Applications.AsNoTracking()
            .Where(a => jobId == null || a.JobId == jobId)
            .GroupBy(a => a.CurrentState)
            .Select(g => new StateCount(g.Key, g.Count()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<LabelCount>> GetRejectReasonsAsync(long companyId, long? jobId)
    {
        return await _db.Applications.AsNoTracking()
            .Where(a => (jobId == null || a.JobId == jobId)
                        && a.CurrentState == "REJECTED"
                        && a.RejectReason != null)
            .GroupBy(a => a.RejectReason)
            .Select(g => new LabelCount(g.Key, g.Count()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<LabelCount>> GetSourceBreakdownAsync(long companyId, long? jobId)
    {
        return await _db.Applications.AsNoTracking()
            .Where(a => jobId == null || a.JobId == jobId)
            .Join(_db.Candidates.AsNoTracking(), a => a.CandidateId, c => c.CandidateId, (a, c) => c.Source)
            .GroupBy(s => s)
            .Select(g => new LabelCount(g.Key, g.Count()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<LabelCount>> GetOfferStatusCountsAsync(long companyId, long? jobId)
    {
        var q = _db.OfferDetails.AsNoTracking();
        if (jobId is long jid)
            q = q.Where(o => _db.Applications.Any(a => a.ApplicationId == o.ApplicationId && a.JobId == jid));

        return await q
            .GroupBy(o => o.Status)
            .Select(g => new LabelCount(g.Key, g.Count()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<double>> GetHireDurationDaysAsync(long companyId, long? jobId)
    {
        var rows = await _db.Applications.AsNoTracking()
            .Where(a => (jobId == null || a.JobId == jobId)
                        && a.CurrentState == "HIRED"
                        && a.HiredAt != null
                        && a.CreatedAt != null)
            .Select(a => new { a.CreatedAt, a.HiredAt })
            .ToListAsync();

        // Chênh lệch tính ở .NET (số hồ sơ HIRED nhỏ; tránh phụ thuộc hàm DATEDIFF của provider).
        return rows
            .Select(r => (r.HiredAt!.Value - r.CreatedAt!.Value).TotalDays)
            .Where(d => d >= 0)
            .ToList();
    }
}
