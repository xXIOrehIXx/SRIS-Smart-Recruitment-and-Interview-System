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

        var slotList = slots.ToList();
        var allPanel = new List<InterviewSlotInterviewer>();
        foreach (var s in slotList)
        {
            s.CompanyId = companyId;
            s.PoolId = pool.PoolId;
            s.Status = InterviewSlotStatus.Open;
            _db.InterviewSlots.Add(s);
        }
        await _db.SaveChangesAsync();

        // Panel interviewer — tạo SAU khi slot có slot_id (FK).
        foreach (var s in slotList)
        {
            foreach (var iid in s.InterviewerIds ?? new List<long>())
            {
                allPanel.Add(new InterviewSlotInterviewer
                {
                    SlotId = s.SlotId,
                    CompanyId = companyId,
                    InterviewerId = iid,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
        if (allPanel.Count > 0)
        {
            _db.InterviewSlotInterviewers.AddRange(allPanel);
            await _db.SaveChangesAsync();
        }

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
                .Include(x => x.Interviewers)
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
        var q = _db.InterviewSlots
            .AsNoTracking()
            .Include(x => x.Interviewers)
            .Where(x => x.PoolId == poolId);
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
            .Include(x => x.Interviewers)
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
        // Có slot nào BOOKED đúng giờ mà interviewer này nằm trong panel không?
        return await _db.InterviewSlotInterviewers
            .AsNoTracking()
            .AnyAsync(si =>
                si.InterviewerId == interviewerId &&
                _db.InterviewSlots.Any(s =>
                    s.SlotId == si.SlotId &&
                    s.SlotId != excludeSlotId &&
                    s.StartTime == startTime &&
                    s.Status == InterviewSlotStatus.Booked));
    }

    /// <summary>
    /// Check cả panel 1 lúc: trả về interviewer_id đầu tiên trong panel đã có lịch BOOKED đúng giờ
    /// (slot khác). Trả null nếu cả panel rảnh. Dùng khi ứng viên chốt khung.
    /// </summary>
    public async Task<long?> FindBusyInterviewerAsync(
        long companyId, IReadOnlyList<long> interviewerIds, DateTime startTime, long excludeSlotId)
    {
        if (interviewerIds.Count == 0) return null;
        return await _db.InterviewSlotInterviewers
            .AsNoTracking()
            .Where(si =>
                interviewerIds.Contains(si.InterviewerId) &&
                _db.InterviewSlots.Any(s =>
                    s.SlotId == si.SlotId &&
                    s.SlotId != excludeSlotId &&
                    s.StartTime == startTime &&
                    s.Status == InterviewSlotStatus.Booked))
            // Cast nullable TRƯỚC FirstOrDefault: long thường trả default(long)=0 khi
            // không có ai bận -> "0 is not null" làm check trùng giờ LUÔN chặn (bug 409).
            .Select(si => (long?)si.InterviewerId)
            .FirstOrDefaultAsync();
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
        long companyId, long jobId, long applicationId, IReadOnlyList<long> interviewerIds,
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
            StartTime = startTime,
            Status = InterviewSlotStatus.Booked,
            BookedApplicationId = applicationId
        };
        _db.InterviewSlots.Add(slot);
        await _db.SaveChangesAsync();

        foreach (var iid in interviewerIds)
        {
            _db.InterviewSlotInterviewers.Add(new InterviewSlotInterviewer
            {
                SlotId = slot.SlotId,
                CompanyId = companyId,
                InterviewerId = iid,
                CreatedAt = DateTime.UtcNow
            });
        }
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
            join si in _db.InterviewSlotInterviewers.AsNoTracking() on sl.SlotId equals si.SlotId
            where s.ScheduleId == scheduleId && si.InterviewerId == interviewerId
            select s.ScheduleId;
        return await query.AnyAsync();
    }

    /// <summary>
    /// Số interviewer trong panel của buổi (đếm từ InterviewSlotInterviewer của slot đã chốt).
    /// Trả 0 nếu buổi chưa CONFIRMED hoặc không tìm thấy.
    /// </summary>
    public async Task<int> GetPanelSizeAsync(long companyId, long scheduleId)
    {
        var query =
            from s in _db.InterviewSchedules.AsNoTracking()
            join sl in _db.InterviewSlots.AsNoTracking() on s.ConfirmedSlotId equals sl.SlotId
            join si in _db.InterviewSlotInterviewers.AsNoTracking() on sl.SlotId equals si.SlotId
            where s.ScheduleId == scheduleId
            select si.InterviewerId;
        var ids = await query.Distinct().ToListAsync();
        return ids.Count;
    }

    /// <summary>StartTime của slot đã chốt của buổi. Trả DateTime.MinValue nếu chưa chốt.</summary>
    public async Task<DateTime> GetConfirmedSlotStartAsync(long companyId, long scheduleId)
    {
        var query =
            from s in _db.InterviewSchedules.AsNoTracking()
            join sl in _db.InterviewSlots.AsNoTracking() on s.ConfirmedSlotId equals sl.SlotId
            where s.ScheduleId == scheduleId
            select sl.StartTime;
        return await query.FirstOrDefaultAsync();
    }

    public async Task<IReadOnlyList<InterviewerScheduleRow>> GetSchedulesForInterviewerAsync(
        long companyId, long interviewerId)
    {
        // Join Application/Candidate/Job để danh sách buổi cần chấm hiện được TÊN ứng viên +
        // vị trí + giờ hẹn (không bắt interviewer bấm vào từng buổi mới biết ai).
        //
        // LeftJoin InterviewScores (đã có DRAFT/SUBMITTED nào của CHÍNH interviewer này chưa) để
        // FE biết buổi nào "đã nộp / đang nháp / chưa chấm" mà không cần gọi thêm API.
        // - Có 1 row DRAFT → "DRAFT"
        // - Có 1 row SUBMITTED → "SUBMITTED"
        // - Không có row nào → "NOT_STARTED"
        var scoreStatus =
            from sc in _db.InterviewScores.AsNoTracking()
            where sc.CompanyId == companyId && sc.InterviewerId == interviewerId
            group sc by sc.ScheduleId into g
            select new
            {
                ScheduleId = g.Key,
                // Ưu tiên SUBMITTED > DRAFT (1 interviewer chỉ có 1 phiếu / criteria nhưng
                // nếu lỡ có nhiều row lịch sử thì lấy mức cao nhất).
                Status = g.Max(x => x.Status),
            };

        var query =
            from s in _db.InterviewSchedules.AsNoTracking()
            join sl in _db.InterviewSlots.AsNoTracking() on s.ConfirmedSlotId equals sl.SlotId
            // Panel: interviewer nằm trong bảng nối InterviewSlotInterviewer (1 khung 1..N người)
            join si in _db.InterviewSlotInterviewers.AsNoTracking() on sl.SlotId equals si.SlotId
            join a in _db.Applications.AsNoTracking() on s.ApplicationId equals a.ApplicationId
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            join my in scoreStatus on s.ScheduleId equals my.ScheduleId into myJoin
            from my in myJoin.DefaultIfEmpty()
            where si.InterviewerId == interviewerId
            orderby s.ScheduleId descending
            select new InterviewerScheduleRow(
                s.ScheduleId, s.ApplicationId, s.RoundNumber, s.Status,
                sl.StartTime, c.FullName, c.Email, j.Title,
                my.Status ?? "NOT_STARTED");
        return await query.ToListAsync();
    }
}
