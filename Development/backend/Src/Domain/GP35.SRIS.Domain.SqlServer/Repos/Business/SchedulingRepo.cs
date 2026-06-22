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

    public async Task<long> InsertScheduleWithSlotsAsync(
        long companyId, InterviewSchedule schedule, IEnumerable<InterviewSlot> slots)
    {
        schedule.CompanyId = companyId;

        await using var tx = await _db.Database.BeginTransactionAsync();

        _db.InterviewSchedules.Add(schedule);
        await _db.SaveChangesAsync();

        foreach (var s in slots)
        {
            s.CompanyId = companyId;
            s.ScheduleId = schedule.ScheduleId;
            _db.InterviewSlots.Add(s);
        }
        await _db.SaveChangesAsync();

        await tx.CommitAsync();
        return schedule.ScheduleId;
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

    public async Task<IReadOnlyList<ScheduleWithSlots>> GetByApplicationAsync(long companyId, long applicationId)
    {
        var schedules = await _db.InterviewSchedules
            .AsNoTracking()
            .Where(s => s.ApplicationId == applicationId)
            .OrderBy(s => s.RoundNumber)
            .ToListAsync();

        var result = new List<ScheduleWithSlots>();
        foreach (var sch in schedules)
        {
            var slots = await _db.InterviewSlots
                .AsNoTracking()
                .Where(x => x.ScheduleId == sch.ScheduleId)
                .OrderBy(x => x.StartTime)
                .ToListAsync();
            result.Add(new ScheduleWithSlots(sch, slots));
        }
        return result;
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

    public async Task<IReadOnlyList<InterviewSlot>> GetSlotsAsync(long companyId, long scheduleId, bool onlyOpenFuture)
    {
        var q = _db.InterviewSlots.AsNoTracking().Where(x => x.ScheduleId == scheduleId);
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

    public async Task<bool> BookAndConfirmAsync(long companyId, long scheduleId, long slotId)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        // Khóa lạc quan: chỉ ăn dòng nếu khung CÒN OPEN (người chốt sau rowcount=0).
        var booked = await _db.InterviewSlots
            .Where(x => x.SlotId == slotId && x.Status == InterviewSlotStatus.Open)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, InterviewSlotStatus.Booked)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        if (booked == 0)
        {
            await tx.RollbackAsync();
            return false;
        }

        // Khóa các khung còn lại của lịch (mỗi giờ thật chỉ dùng 1 lần).
        await _db.InterviewSlots
            .Where(x => x.ScheduleId == scheduleId && x.Status == InterviewSlotStatus.Open)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, InterviewSlotStatus.Locked)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        await _db.InterviewSchedules
            .Where(s => s.ScheduleId == scheduleId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, InterviewScheduleStatus.Confirmed)
                .SetProperty(x => x.ConfirmedSlotId, slotId)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        await tx.CommitAsync();
        return true;
    }

    public async Task SetScheduleStatusAsync(long companyId, long scheduleId, string status)
    {
        await _db.InterviewSchedules
            .Where(s => s.ScheduleId == scheduleId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, status)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<bool> IsInterviewerOnScheduleAsync(long companyId, long scheduleId, long interviewerId)
    {
        return await _db.InterviewSlots
            .AsNoTracking()
            .AnyAsync(x => x.ScheduleId == scheduleId && x.InterviewerId == interviewerId);
    }

    public async Task<IReadOnlyList<InterviewSchedule>> GetSchedulesForInterviewerAsync(
        long companyId, long interviewerId)
    {
        var scheduleIds = await _db.InterviewSlots
            .AsNoTracking()
            .Where(x => x.InterviewerId == interviewerId)
            .Select(x => x.ScheduleId)
            .Distinct()
            .ToListAsync();

        return await _db.InterviewSchedules
            .AsNoTracking()
            .Where(s => scheduleIds.Contains(s.ScheduleId))
            .OrderByDescending(s => s.ScheduleId)
            .ToListAsync();
    }

    public async Task<InterviewSchedule?> GetScheduleByIdAsync(long companyId, long scheduleId)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ScheduleId == scheduleId);
    }
}
