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

    public async Task<IReadOnlyList<KanbanCard>> GetKanbanCardsAsync(long companyId, long? jobId)
    {
        // Bước 1: lấy dữ liệu thô về memory (EF Core không translate được orderby với ??).
        var raw = await (
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            where jobId == null || a.JobId == jobId.Value
            select new
            {
                a.ApplicationId,
                c.CandidateId,
                c.FullName,
                c.Email,
                j.Title,
                a.JobId,
                a.CurrentState,
                a.AiMatchScore,
                a.CreatedAt,
                a.StageUpdatedAt
            })
            .ToListAsync();

        // Bước 2: map + sort ở memory (không qua SQL).
        return raw
            .Select(x => new KanbanCard(
                x.ApplicationId,
                x.CandidateId,
                x.FullName,
                x.Email,
                x.Title,
                x.JobId,
                x.CurrentState,
                x.AiMatchScore,
                x.CreatedAt ?? DateTime.MinValue,
                x.StageUpdatedAt))
            .OrderByDescending(c => c.StageUpdatedAt ?? c.AppliedAt)
            .ToList();
    }

    public async Task<IReadOnlyList<KanbanCard>> GetRecentApplicationsAsync(long companyId, long? jobId, int take)
    {
        // Lọc/sort trên cột entity TRƯỚC rồi mới project vào record (EF không compose được
        // Where/OrderBy sau constructor projection).
        return await (
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            where jobId == null || a.JobId == jobId.Value
            orderby a.ApplicationId descending
            select new KanbanCard(a.ApplicationId, c.CandidateId, c.FullName, c.Email, j.Title,
                a.JobId, a.CurrentState, a.AiMatchScore, a.CreatedAt ?? DateTime.MinValue, a.StageUpdatedAt))
            .Take(take)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<KanbanCard>> GetRecentDecisionsAsync(long companyId, long? jobId, int take)
    {
        return await (
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            where (jobId == null || a.JobId == jobId.Value)
                  && (a.CurrentState == "HIRED" || a.CurrentState == "REJECTED")
            // stage_updated_at luôn set khi transition; tránh ?? trong ORDER BY (EF không translate)
            orderby a.StageUpdatedAt descending
            select new KanbanCard(a.ApplicationId, c.CandidateId, c.FullName, c.Email, j.Title,
                a.JobId, a.CurrentState, a.AiMatchScore, a.CreatedAt ?? DateTime.MinValue, a.StageUpdatedAt))
            .Take(take)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<DepartmentCount>> GetDepartmentProgressAsync(long companyId)
    {
        return await (
            from a in _db.Applications.AsNoTracking()
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            where j.Department != null && j.Department != ""
            group a by j.Department into g
            orderby g.Count() descending
            select new DepartmentCount(
                g.Key!,
                g.Count(x => x.CurrentState == "HIRED"),
                g.Count()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<ActivityRow>> GetRecentActivitiesAsync(long companyId, int take)
    {
        return await (
            from log in _db.ActivityLogs.AsNoTracking()
            join a in _db.Applications.AsNoTracking() on log.ApplicationId equals a.ApplicationId
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            orderby log.LogId descending
            select new ActivityRow(log.ApplicationId, c.FullName, log.Action,
                log.FromState, log.ToState, log.CreatedAt))
            .Take(take)
            .ToListAsync();
    }
}
