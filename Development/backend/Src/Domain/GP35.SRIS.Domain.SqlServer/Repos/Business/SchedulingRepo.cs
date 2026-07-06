using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class SchedulingRepo : BaseRepo<long, InterviewSchedule>, ISchedulingRepo
{
    private readonly SrisDbContext _db;

    public SchedulingRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    // ---------- Pool ----------

    public async Task<long> InsertPoolWithSlotsAsync(
        long companyId, InterviewSlotPool pool, IEnumerable<InterviewSlot> slots)
    {
        pool.CompanyId = companyId;

        await using var tx = await _db.Database.BeginTransactionAsync();

        _db.InterviewSlotPools.Add(pool);
        await _db.SaveChangesAsync();

        foreach (var s in slots)
        {
            s.CompanyId = companyId;
            s.PoolId = pool.PoolId;
            s.Status = InterviewSlotStatus.Open;
            _db.InterviewSlots.Add(s);
        }
        await _db.SaveChangesAsync();

        await tx.CommitAsync();
        return pool.PoolId;
    }

    public async Task<InterviewSlotPool?> GetPoolByIdAsync(long companyId, long poolId)
    {
        return await _db.InterviewSlotPools
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.PoolId == poolId);
    }

    public async Task<IReadOnlyList<PoolWithSlots>> GetPoolsByJobAsync(long companyId, long jobId)
    {
        var pools = await _db.InterviewSlotPools
            .AsNoTracking()
            .Where(p => p.JobId == jobId)
            .OrderByDescending(p => p.PoolId)
            .ToListAsync();

        var result = new List<PoolWithSlots>();
        foreach (var pool in pools)
        {
            var slots = await _db.InterviewSlots
                .AsNoTracking()
                .Where(x => x.PoolId == pool.PoolId)
                .OrderBy(x => x.StartTime)
                .ToListAsync();
            result.Add(new PoolWithSlots(pool, slots));
        }
        return result;
    }

    public async Task<IReadOnlyList<InterviewSlot>> GetSlotsByPoolAsync(
        long companyId, long poolId, bool onlyOpenFuture)
    {
        var q = _db.InterviewSlots.AsNoTracking().Where(x => x.PoolId == poolId);
        if (onlyOpenFuture)
        {
            var now = DateTime.UtcNow;
            q = q.Where(x => x.Status == InterviewSlotStatus.Open && x.StartTime > now);
        }
        return await q.OrderBy(x => x.StartTime).ToListAsync();
    }

    public async Task<InterviewSlot?> GetSlotAsync(long companyId, long slotId)
    {
        return await _db.InterviewSlots
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.SlotId == slotId);
    }

    public async Task<bool> CancelPoolAsync(long companyId, long poolId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        // Khóa lạc quan: chỉ hủy nếu pool CHƯA bị hủy trước đó.
        var cancelled = await _db.InterviewSlotPools
            .Where(p => p.PoolId == poolId && p.Status != InterviewPoolStatus.Cancelled)
            .ExecuteUpdateAsync(p => p
                .SetProperty(x => x.Status, InterviewPoolStatus.Cancelled)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        if (cancelled == 0)
        {
            await tx.RollbackAsync();
            return false;
        }

        // Khóa mọi khung chưa khóa (giờ không còn dùng được).
        await _db.InterviewSlots
            .Where(x => x.PoolId == poolId && x.Status != InterviewSlotStatus.Locked)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, InterviewSlotStatus.Locked)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        // Invite còn chờ -> CANCELLED (ứng viên chưa chốt thì thôi).
        await _db.InterviewSchedules
            .Where(s => s.PoolId == poolId && s.Status == InterviewScheduleStatus.Pending)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, InterviewScheduleStatus.Cancelled)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        await tx.CommitAsync();
        return true;
    }

    // ---------- Invite / lịch per-ứng-viên ----------

    public async Task<long> InsertInviteScheduleAsync(long companyId, InterviewSchedule schedule)
    {
        schedule.CompanyId = companyId;
        schedule.Status = InterviewScheduleStatus.Pending;
        _db.InterviewSchedules.Add(schedule);
        await _db.SaveChangesAsync();
        return schedule.ScheduleId;
    }

    public async Task<IReadOnlyList<InterviewSchedule>> GetSchedulesByPoolAsync(long companyId, long poolId)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .Where(s => s.PoolId == poolId)
            .OrderBy(s => s.ScheduleId)
            .ToListAsync();
    }

    public async Task<bool> HasActiveInviteInPoolAsync(long companyId, long poolId, long applicationId)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .AnyAsync(s => s.PoolId == poolId
                && s.ApplicationId == applicationId
                && (s.Status == InterviewScheduleStatus.Pending
                    || s.Status == InterviewScheduleStatus.Confirmed));
    }

    public async Task<InterviewSchedule?> GetLatestPendingScheduleAsync(long companyId, long applicationId)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .Where(s => s.ApplicationId == applicationId && s.Status == InterviewScheduleStatus.Pending)
            .OrderByDescending(s => s.ScheduleId)
            .FirstOrDefaultAsync();
    }

    public async Task<InterviewSchedule?> GetLatestScheduleAsync(long companyId, long applicationId)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .Where(s => s.ApplicationId == applicationId)
            .OrderByDescending(s => s.ScheduleId)
            .FirstOrDefaultAsync();
    }

    public async Task<InterviewSchedule?> GetScheduleByIdAsync(long companyId, long scheduleId)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ScheduleId == scheduleId);
    }

    public async Task<int> CountNoSlotFitsAsync(long companyId, long applicationId)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .CountAsync(s => s.ApplicationId == applicationId
                && s.Status == InterviewScheduleStatus.NoSlotFits);
    }

    public async Task<int> GetNextRoundNumberAsync(long companyId, long applicationId)
    {
        var max = await _db.InterviewSchedules
            .AsNoTracking()
            .Where(s => s.ApplicationId == applicationId)
            .Select(s => (int?)s.RoundNumber)
            .MaxAsync();
        return (max ?? 0) + 1;
    }

    // ---------- Chốt khung ----------

    public async Task<bool> BookAndConfirmAsync(
        long companyId, long scheduleId, long slotId, long applicationId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        // Khóa lạc quan: chỉ ăn dòng nếu khung CÒN OPEN (người chốt sau rowcount=0). Gắn ứng viên đặt.
        var booked = await _db.InterviewSlots
            .Where(x => x.SlotId == slotId && x.Status == InterviewSlotStatus.Open)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, InterviewSlotStatus.Booked)
                .SetProperty(x => x.BookedApplicationId, applicationId)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        if (booked == 0)
        {
            await tx.RollbackAsync();
            return false;
        }

        // KHÔNG khóa khung anh em — pool dùng chung, giữ OPEN cho người sau.
        await _db.InterviewSchedules
            .Where(s => s.ScheduleId == scheduleId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, InterviewScheduleStatus.Confirmed)
                .SetProperty(x => x.ConfirmedSlotId, slotId)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        await tx.CommitAsync();
        return true;
    }

    public async Task<bool> IsInterviewerBookedAtAsync(
        long companyId, long interviewerId, DateTime startTime, long excludeSlotId)
    {
        return await _db.InterviewSlots
            .AsNoTracking()
            .AnyAsync(x => x.InterviewerId == interviewerId
                && x.StartTime == startTime
                && x.Status == InterviewSlotStatus.Booked
                && x.SlotId != excludeSlotId);
    }

    public async Task SetScheduleStatusAsync(long companyId, long scheduleId, string status)
    {
        await _db.InterviewSchedules
            .Where(s => s.ScheduleId == scheduleId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, status)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<long> ManualConfirmAsync(
        long companyId, long jobId, long applicationId, long interviewerId,
        DateTime startTime, int roundNumber, long? createdBy)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        // Pool 1 khung, đóng luôn (không mời ai qua magic link).
        var pool = new InterviewSlotPool
        {
            CompanyId = companyId,
            JobId = jobId,
            RoundNumber = roundNumber,
            Status = InterviewPoolStatus.Closed,
            CreatedBy = createdBy
        };
        _db.InterviewSlotPools.Add(pool);
        await _db.SaveChangesAsync();

        var slot = new InterviewSlot
        {
            CompanyId = companyId,
            PoolId = pool.PoolId,
            InterviewerId = interviewerId,
            StartTime = startTime,
            Status = InterviewSlotStatus.Booked,
            BookedApplicationId = applicationId
        };
        _db.InterviewSlots.Add(slot);
        await _db.SaveChangesAsync();

        var schedule = new InterviewSchedule
        {
            CompanyId = companyId,
            ApplicationId = applicationId,
            PoolId = pool.PoolId,
            RoundNumber = roundNumber,
            Status = InterviewScheduleStatus.Confirmed,
            ConfirmedSlotId = slot.SlotId
        };
        _db.InterviewSchedules.Add(schedule);
        await _db.SaveChangesAsync();

        await tx.CommitAsync();
        return schedule.ScheduleId;
    }

    // ---------- Chấm điểm (interviewer = người của KHUNG ĐÃ CHỐT) ----------

    public async Task<bool> IsInterviewerOnScheduleAsync(long companyId, long scheduleId, long interviewerId)
    {
        var query =
            from s in _db.InterviewSchedules.AsNoTracking()
            join sl in _db.InterviewSlots.AsNoTracking() on s.ConfirmedSlotId equals sl.SlotId
            where s.ScheduleId == scheduleId && sl.InterviewerId == interviewerId
            select s.ScheduleId;
        return await query.AnyAsync();
    }

    public async Task<IReadOnlyList<InterviewSchedule>> GetSchedulesForInterviewerAsync(
        long companyId, long interviewerId)
    {
        var query =
            from s in _db.InterviewSchedules.AsNoTracking()
            join sl in _db.InterviewSlots.AsNoTracking() on s.ConfirmedSlotId equals sl.SlotId
            where sl.InterviewerId == interviewerId
            orderby s.ScheduleId descending
            select s;
        return await query.ToListAsync();
    }
}
