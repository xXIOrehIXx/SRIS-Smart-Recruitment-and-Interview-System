using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class ApplicationRepo : BaseRepo<long, Application>, IApplicationRepo
{
    private readonly SrisDbContext _db;

    public ApplicationRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, Application application)
    {
        application.CompanyId = companyId;
        _db.Applications.Add(application);
        await _db.SaveChangesAsync();
        return application.ApplicationId;
    }

    public async Task<Application?> GetByIdAsync(long companyId, long applicationId)
    {
        return await _db.Applications
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.ApplicationId == applicationId);
    }

    public async Task<int> TransitionStateAsync(
        long companyId, long applicationId, string toState, string? rejectReason,
        DateTime stageUpdatedAt, DateTime? rejectedAt, DateTime? hiredAt)
    {
        // ExecuteUpdate tôn trọng Global Query Filter (tự kèm company_id); RLS BLOCK chặn ghi sai tenant.
        return await _db.Applications
            .Where(a => a.ApplicationId == applicationId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(a => a.CurrentState, toState)
                .SetProperty(a => a.RejectReason, rejectReason)
                .SetProperty(a => a.StageUpdatedAt, stageUpdatedAt)
                .SetProperty(a => a.RejectedAt, rejectedAt)
                .SetProperty(a => a.HiredAt, hiredAt)
                .SetProperty(a => a.UpdatedAt, stageUpdatedAt));
    }

    public async Task<int> CountSubmittedInterviewScoresAsync(long companyId, long applicationId)
    {
        // InterviewScore nối hồ sơ qua InterviewSchedule (chưa map entity -> raw SQL, cửa thoát 5.11).
        return await _db.Database
            .SqlQueryRaw<int>(
                "SELECT COUNT(*) AS Value " +
                "FROM InterviewScore sc " +
                "JOIN InterviewSchedule s ON s.schedule_id = sc.schedule_id " +
                "WHERE s.application_id = {0} AND s.company_id = {1} " +
                "  AND sc.company_id = {1} AND sc.status = 'SUBMITTED'",
                applicationId, companyId)
            .SingleAsync();
    }

    public async Task<ApplicationContactInfo?> GetContactInfoAsync(long companyId, long applicationId)
    {
        // Join Candidate (email/tên) + Job (tên vị trí). Global Query Filter kèm company_id mọi bảng.
        return await (
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            where a.ApplicationId == applicationId
            select new ApplicationContactInfo(
                a.ApplicationId, c.Email, c.FullName, j.Title, a.CurrentState))
            .FirstOrDefaultAsync();
    }

    public async Task<IReadOnlyList<ApplicationBoardRow>> GetBoardByJobAsync(
        long companyId, long jobId, BoardSort sort = BoardSort.Recent)
    {
        // Toàn bộ hồ sơ của job cho Kanban; FE tự nhóm theo current_state.
        //
        // LEFT JOIN sang CvScreening: mỗi hồ sơ nhiều nhất MỘT dòng sàng lọc (UNIQUE
        // application_id, bấm phân tích lại là ghi đè) nên join này không nhân bản card.
        // Global Query Filter tự kèm company_id cho cả ba bảng.
        var joined =
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join s in _db.CvScreenings.AsNoTracking() on a.ApplicationId equals s.ApplicationId into screenings
            from s in screenings.DefaultIfEmpty()
            where a.JobId == jobId
            select new { a, c, s };

        // Sắp xếp TRƯỚC khi projection, trên chính cột của bảng: xếp thứ tự theo property của
        // record vừa dựng thì EF phải lần ngược lại biểu thức để dịch, và câu ORDER BY đó dễ
        // rơi ra client-side. Ở đây thứ tự phải do SQL Server làm — nó quyết định trang đầu
        // người tuyển dụng nhìn thấy.
        //
        // Hồ sơ chưa có điểm dồn xuống đáy chứ KHÔNG coi như 0 (khoá sắp xếp đầu tiên nói rõ
        // điều đó, không phó mặc cho quy ước NULL của từng hệ quản trị). Cùng điểm thì mới nộp
        // trước — giữ thói quen cũ làm tiêu chí phụ.
        joined = sort == BoardSort.Fit
            ? joined
                .OrderByDescending(x => x.s != null && x.s.Status == ScreeningStatus.Done && x.s.FitScore != null)
                .ThenByDescending(x => x.s != null && x.s.Status == ScreeningStatus.Done ? x.s.FitScore : null)
                .ThenByDescending(x => x.a.CreatedAt)
            : joined.OrderByDescending(x => x.a.CreatedAt);

        return await joined
            .Select(x => new ApplicationBoardRow(
                x.a.ApplicationId, x.a.CandidateId, x.c.FullName, x.c.Email,
                x.a.CurrentState, x.a.CvId, x.a.CreatedAt,
                x.s == null ? null : x.s.Status,
                // Điểm chỉ có nghĩa khi lượt sàng lọc đã DONE. Dòng đang PENDING/RUNNING vẫn giữ
                // điểm cũ = null (EnqueueAsync xoá sạch kết quả lúc xếp hàng), nhưng chặn ở đây
                // cho chắc: FAILED mà lọt điểm ra ngoài thì card hiện điểm của một lượt đã hỏng.
                x.s == null || x.s.Status != ScreeningStatus.Done ? null : x.s.FitScore,
                x.s == null || x.s.Status != ScreeningStatus.Done ? null : x.s.Decision))
            .ToListAsync();
    }

    public async Task<ApplicationDetailRow?> GetDetailAsync(long companyId, long applicationId)
    {
        return await (
            from a in _db.Applications.AsNoTracking()
            join c in _db.Candidates.AsNoTracking() on a.CandidateId equals c.CandidateId
            join j in _db.Jobs.AsNoTracking() on a.JobId equals j.JobId
            join cv in _db.CvDocuments.AsNoTracking() on a.CvId equals cv.CvId
            where a.ApplicationId == applicationId
            select new ApplicationDetailRow(
                a.ApplicationId, a.CurrentState,
                a.RejectReason, a.CreatedAt, a.StageUpdatedAt,
                c.CandidateId, c.FullName, c.Email, c.Phone, c.Source,
                j.JobId, j.Title,
                cv.CvId, cv.FileName, cv.ParseStatus))
            .FirstOrDefaultAsync();
    }
}
