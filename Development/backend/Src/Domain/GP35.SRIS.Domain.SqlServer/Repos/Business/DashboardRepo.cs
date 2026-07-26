using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using ApplicationEntity = GP35.SRIS.Domain.Entities.Application;

namespace GP35.SRIS.Domain.SqlServer.Repos;

/// <summary>
/// Tổng hợp Dashboard bằng LINQ GroupBy (EF tự kèm company_id qua Global Query Filter — cô lập tenant).
/// jobId null = toàn công ty. AsNoTracking cho mọi truy vấn đọc.
/// V023: departmentManagerId != null -> mọi truy vấn thu hẹp về phạm vi phòng ban của DM đó
/// (xem <see cref="ScopedApplications"/>).
/// </summary>
public class DashboardRepo : IDashboardRepo
{
    private readonly SrisDbContext _db;

    public DashboardRepo(IServiceProvider serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    /// <summary>
    /// Nguồn hồ sơ chung cho mọi truy vấn dashboard, đã áp 2 bộ lọc tùy chọn:
    /// <list type="bullet">
    ///   <item>jobId — xem 1 job cụ thể.</item>
    ///   <item>departmentManagerId (V023) — chỉ job DM này phụ trách, cộng job chưa gán DM
    ///   (job không gán DM = Recruiter quyết, không thuộc riêng phòng nào nên vẫn cho xem).</item>
    /// </list>
    /// Cả hai null -> không thêm điều kiện nào, SQL sinh ra y như trước.
    /// </summary>
    private IQueryable<ApplicationEntity> ScopedApplications(long? jobId, long? departmentManagerId)
    {
        var q = _db.Applications.AsNoTracking();

        if (jobId is long jid)
            q = q.Where(a => a.JobId == jid);

        if (departmentManagerId is long dmId)
            q = q.Where(a => _db.Jobs.Any(j => j.JobId == a.JobId
                                               && (j.DepartmentManagerId == dmId || j.DepartmentManagerId == null)));

        return q;
    }

    public async Task<IReadOnlyList<StateCount>> GetFunnelAsync(long companyId, long? jobId, long? departmentManagerId = null)
    {
        return await ScopedApplications(jobId, departmentManagerId)
            .GroupBy(a => a.CurrentState)
            .Select(g => new StateCount(g.Key, g.Count()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<LabelCount>> GetRejectReasonsAsync(long companyId, long? jobId, long? departmentManagerId = null)
    {
        return await ScopedApplications(jobId, departmentManagerId)
            .Where(a => a.CurrentState == "REJECTED" && a.RejectReason != null)
            .GroupBy(a => a.RejectReason)
            .Select(g => new LabelCount(g.Key, g.Count()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<LabelCount>> GetSourceBreakdownAsync(long companyId, long? jobId, long? departmentManagerId = null)
    {
        return await ScopedApplications(jobId, departmentManagerId)
            .Join(_db.Candidates.AsNoTracking(), a => a.CandidateId, c => c.CandidateId, (a, c) => c.Source)
            .GroupBy(s => s)
            .Select(g => new LabelCount(g.Key, g.Count()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<LabelCount>> GetOfferStatusCountsAsync(long companyId, long? jobId, long? departmentManagerId = null)
    {
        var q = _db.OfferDetails.AsNoTracking();
        if (jobId is not null || departmentManagerId is not null)
        {
            var scoped = ScopedApplications(jobId, departmentManagerId);
            q = q.Where(o => scoped.Any(a => a.ApplicationId == o.ApplicationId));
        }

        return await q
            .GroupBy(o => o.Status)
            .Select(g => new LabelCount(g.Key, g.Count()))
            .ToListAsync();
    }

    public async Task<IReadOnlyList<double>> GetHireDurationDaysAsync(long companyId, long? jobId, long? departmentManagerId = null)
    {
        var rows = await ScopedApplications(jobId, departmentManagerId)
            .Where(a => a.CurrentState == "HIRED" && a.HiredAt != null && a.CreatedAt != null)
            .Select(a => new { a.CreatedAt, a.HiredAt })
            .ToListAsync();

        // Chênh lệch tính ở .NET (số hồ sơ HIRED nhỏ; tránh phụ thuộc hàm DATEDIFF của provider).
        return rows
            .Select(r => (r.HiredAt!.Value - r.CreatedAt!.Value).TotalDays)
            .Where(d => d >= 0)
            .ToList();
    }

    public async Task<IReadOnlyList<KanbanCard>> GetKanbanCardsAsync(long companyId, long? jobId, long? departmentManagerId = null)
    {
        // Bước 1: lấy dữ liệu thô về memory (EF Core không translate được orderby với ??).
        var raw = await (
            from a in ScopedApplications(jobId, departmentManagerId)
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
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
                a.StageUpdatedAt,
                j.Department,
                j.DepartmentManagerId
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
                x.StageUpdatedAt,
                x.Department,
                x.DepartmentManagerId))
            .OrderByDescending(c => c.StageUpdatedAt ?? c.AppliedAt)
            .ToList();
    }

    public async Task<IReadOnlyList<KanbanCard>> GetRecentApplicationsAsync(long companyId, long? jobId, int take, long? departmentManagerId = null)
    {
        // Lọc/sort trên cột entity TRƯỚC rồi mới project vào record (EF không compose được
        // Where/OrderBy sau constructor projection).
        return await (
            from a in ScopedApplications(jobId, departmentManagerId)
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            orderby a.ApplicationId descending
            select new KanbanCard(a.ApplicationId, c.CandidateId, c.FullName, c.Email, j.Title,
                a.JobId, a.CurrentState, a.AiMatchScore, a.CreatedAt ?? DateTime.MinValue, a.StageUpdatedAt))
            .Take(take)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<KanbanCard>> GetRecentDecisionsAsync(long companyId, long? jobId, int take, long? departmentManagerId = null)
    {
        return await (
            from a in ScopedApplications(jobId, departmentManagerId)
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            where a.CurrentState == "HIRED" || a.CurrentState == "REJECTED"
            // stage_updated_at luôn set khi transition; tránh ?? trong ORDER BY (EF không translate)
            orderby a.StageUpdatedAt descending
            select new KanbanCard(a.ApplicationId, c.CandidateId, c.FullName, c.Email, j.Title,
                a.JobId, a.CurrentState, a.AiMatchScore, a.CreatedAt ?? DateTime.MinValue, a.StageUpdatedAt))
            .Take(take)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<DepartmentCount>> GetDepartmentProgressAsync(long companyId, long? departmentManagerId = null)
    {
        return await (
            from a in ScopedApplications(null, departmentManagerId)
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

    public async Task<IReadOnlyList<ActivityRow>> GetRecentActivitiesAsync(long companyId, int take, long? departmentManagerId = null)
    {
        return await (
            from log in _db.ActivityLogs.AsNoTracking()
            join a in ScopedApplications(null, departmentManagerId) on log.ApplicationId equals a.ApplicationId
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            orderby log.LogId descending
            select new ActivityRow(log.ApplicationId, c.FullName, log.Action,
                log.FromState, log.ToState, log.CreatedAt))
            .Take(take)
            .ToListAsync();
    }
}
