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

    // ---------- Buổi phỏng vấn (pool 1 khung) ----------

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

    public async Task<IReadOnlyList<JobScheduleRow>> GetSchedulesByJobAsync(long companyId, long jobId)
    {
        // Join qua slot (giờ) + pool (tên vòng) + candidate (tên) để bảng lịch của bộ phận nhân sự
        // hiện đủ trong 1 lần gọi. Buổi mới nhất lên đầu.
        var query =
            from s in _db.InterviewSchedules.AsNoTracking()
            join sl in _db.InterviewSlots.AsNoTracking() on s.ConfirmedSlotId equals sl.SlotId
            join p in _db.InterviewSlotPools.AsNoTracking() on sl.PoolId equals p.PoolId
            join a in _db.Applications.AsNoTracking() on s.ApplicationId equals a.ApplicationId
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            where a.JobId == jobId
            orderby sl.StartTime descending
            select new JobScheduleRow(
                s.ScheduleId, s.ApplicationId, sl.SlotId, s.RoundNumber, p.Name,
                s.Status, sl.StartTime, c.FullName, c.Email, a.CurrentState);
        return await query.ToListAsync();
    }

    public async Task<IReadOnlyDictionary<long, List<long>>> GetPanelsBySlotIdsAsync(
        long companyId, IReadOnlyList<long> slotIds)
    {
        if (slotIds.Count == 0) return new Dictionary<long, List<long>>();

        var rows = await _db.InterviewSlotInterviewers
            .AsNoTracking()
            .Where(x => slotIds.Contains(x.SlotId))
            .Select(x => new { x.SlotId, x.InterviewerId })
            .ToListAsync();

        return rows
            .GroupBy(x => x.SlotId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.InterviewerId).ToList());
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

        // Mọi buổi thuộc pool -> CANCELLED, CẢ buổi ĐÃ CHỐT: hủy pool nghĩa là các buổi này không
        // diễn ra nữa (service đã gửi email báo hủy cho đúng nhóm CONFIRMED này). Bỏ sót CONFIRMED
        // thì buổi "ma" vẫn nằm trong danh sách chấm của interviewer, vẫn tính vào guard G2, và
        // ứng viên được mời lại ở pool mới sẽ có 2 buổi CONFIRMED cùng vòng.
        await _db.InterviewSchedules
            .Where(s => s.PoolId == poolId
                && (s.Status == InterviewScheduleStatus.Pending
                    || s.Status == InterviewScheduleStatus.Confirmed))
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Status, InterviewScheduleStatus.Cancelled)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));

        await tx.CommitAsync();
        return true;
    }

    // ---------- Lịch per-ứng-viên ----------

    public async Task<bool> HasConfirmedScheduleForRoundAsync(
        long companyId, long applicationId, int roundNumber)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .AnyAsync(s => s.ApplicationId == applicationId
                && s.RoundNumber == roundNumber
                && s.Status == InterviewScheduleStatus.Confirmed);
    }

    public async Task<IReadOnlyList<InterviewSchedule>> GetSchedulesByApplicationAsync(long companyId, long applicationId)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .Where(s => s.ApplicationId == applicationId)
            .OrderBy(s => s.RoundNumber)
            .ThenBy(s => s.ScheduleId)
            .ToListAsync();
    }

    public async Task<InterviewSchedule?> GetScheduleByIdAsync(long companyId, long scheduleId)
    {
        return await _db.InterviewSchedules
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.ScheduleId == scheduleId);
    }

    public async Task<int> GetNextRoundNumberAsync(long companyId, long applicationId)
    {
        // Lịch ĐÃ HỦY không tính: buổi đó không diễn ra, nên nó không "chiếm" số vòng. Đếm cả
        // lịch hủy thì hủy vòng 1 xong chốt tay lại ra vòng 2 — trong khi mở pool cho cùng vị
        // trí đó lại ra vòng 1 (CreatePoolAsync bỏ pool CANCELLED), hai đường lệch nhau.
        var max = await _db.InterviewSchedules
            .AsNoTracking()
            .Where(s => s.ApplicationId == applicationId
                && s.Status != InterviewScheduleStatus.Cancelled)
            .Select(s => (int?)s.RoundNumber)
            .MaxAsync();
        return (max ?? 0) + 1;
    }

    // ---------- Chống trùng giờ ----------

    /// <summary>
    /// Check cả panel 1 lúc: interviewer đầu tiên có khung BOOKED (slot khác) rơi vào cửa sổ
    /// ±minGap quanh startTime. Trả null nếu cả panel rảnh. Dùng khi ứng viên chốt khung.
    /// </summary>
    public async Task<BusyInterviewer?> FindBusyInterviewerAsync(
        long companyId, IReadOnlyList<long> interviewerIds, DateTime startTime,
        TimeSpan minGap, long excludeSlotId)
    {
        if (interviewerIds.Count == 0) return null;

        // Biên MỞ: cách nhau đúng minGap là hợp lệ (09:00 và 10:00 không đụng nhau).
        // (Không đặt tên biến là `from` — trùng từ khóa LINQ query syntax.)
        var windowStart = startTime - minGap;
        var windowEnd = startTime + minGap;

        // Project ra record (kiểu tham chiếu) nên FirstOrDefault trả null thật khi rảnh —
        // không dính bẫy default(long)=0 của phiên bản trả long.
        return await (
            from si in _db.InterviewSlotInterviewers.AsNoTracking()
            join s in _db.InterviewSlots.AsNoTracking() on si.SlotId equals s.SlotId
            where interviewerIds.Contains(si.InterviewerId)
                && s.SlotId != excludeSlotId
                && s.Status == InterviewSlotStatus.Booked
                && s.StartTime > windowStart && s.StartTime < windowEnd
            orderby s.StartTime
            select new BusyInterviewer(si.InterviewerId, s.StartTime)
        ).FirstOrDefaultAsync();
    }

    public async Task<DateTime?> FindCandidateBusyAtAsync(
        long companyId, long applicationId, DateTime startTime,
        TimeSpan minGap, long excludeScheduleId)
    {
        var windowStart = startTime - minGap;
        var windowEnd = startTime + minGap;

        return await (
            from sch in _db.InterviewSchedules.AsNoTracking()
            join sl in _db.InterviewSlots.AsNoTracking() on sch.ConfirmedSlotId equals sl.SlotId
            where sch.ApplicationId == applicationId
                && sch.ScheduleId != excludeScheduleId
                && sch.Status == InterviewScheduleStatus.Confirmed
                && sl.StartTime > windowStart && sl.StartTime < windowEnd
            orderby sl.StartTime
            select (DateTime?)sl.StartTime
        ).FirstOrDefaultAsync();
    }

    public async Task<long> ManualConfirmAsync(
        long companyId, long jobId, long applicationId, IReadOnlyList<long> interviewerIds,
        DateTime startTime, int roundNumber, string? roundName, long? createdBy)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        // Pool 1 khung, đóng luôn (không mời ai qua magic link).
        var pool = new InterviewSlotPool
        {
            CompanyId = companyId,
            JobId = jobId,
            RoundNumber = roundNumber,
            Name = roundName,
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
            // Pool: để lấy TÊN vòng (V041) — "Vòng 2 · Phỏng vấn chuyên môn" nói cho interviewer
            // biết buổi này để làm gì, con số chỉ nói thứ tự.
            join p in _db.InterviewSlotPools.AsNoTracking() on sl.PoolId equals p.PoolId
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
                my.Status ?? "NOT_STARTED",
                // Trạng thái hồ sơ -> FE biết buổi nào còn sửa phiếu được (OFFER trở đi là khóa).
                a.CurrentState,
                p.Name);
        return await query.ToListAsync();
    }
}
