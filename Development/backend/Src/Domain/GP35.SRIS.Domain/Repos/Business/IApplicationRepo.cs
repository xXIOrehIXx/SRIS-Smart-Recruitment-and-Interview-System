using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 dòng bảng xếp hạng ứng viên theo điểm.</summary>
public record ApplicationRankingRow(
    long ApplicationId,
    long CandidateId,
    string CandidateName,
    decimal? AiMatchScore,
    string CurrentState);

/// <summary>Thông tin liên hệ ứng viên + vị trí của 1 hồ sơ — để dựng email gửi ứng viên (5.13).</summary>
public record ApplicationContactInfo(
    long ApplicationId,
    string CandidateEmail,
    string CandidateName,
    string JobTitle,
    string CurrentState);

public interface IApplicationRepo : IBaseRepo<long, Application>
{
    /// <summary>Thêm hồ sơ ứng tuyển, trả về application_id vừa sinh.</summary>
    Task<long> InsertAsync(long companyId, Application application);

    /// <summary>Lấy 1 hồ sơ theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<Application?> GetByIdAsync(long companyId, long applicationId);

    /// <summary>
    /// Đo khoảng cách cosine giữa embedding của CV và của JD ngay trong SQL Server
    /// (VECTOR_DISTANCE). Khoảng cách nhỏ = giống nhiều.
    /// </summary>
    Task<double> GetCvJdCosineDistanceAsync(long companyId, long cvId, long jobId);

    /// <summary>Lưu điểm AI (0-100) vào hồ sơ.</summary>
    Task UpdateScoreAsync(long companyId, long applicationId, decimal score);

    /// <summary>Bảng xếp hạng ứng viên của 1 job theo điểm giảm dần.</summary>
    Task<IEnumerable<ApplicationRankingRow>> GetRankingByJobAsync(long companyId, long jobId);

    /// <summary>
    /// Đổi trạng thái hồ sơ (state machine — 5.8) + ghi mốc thời gian. rejectReason chỉ có khi
    /// reject; rejectedAt/hiredAt set tương ứng. Trả số dòng cập nhật (0 = không thấy hồ sơ).
    /// </summary>
    Task<int> TransitionStateAsync(
        long companyId, long applicationId, string toState, string? rejectReason,
        DateTime stageUpdatedAt, DateTime? rejectedAt, DateTime? hiredAt);

    /// <summary>Guard G2: số phiếu chấm phỏng vấn đã SUBMITTED của hồ sơ (qua InterviewSchedule).</summary>
    Task<int> CountSubmittedInterviewScoresAsync(long companyId, long applicationId);

    /// <summary>Email + tên ứng viên + tên vị trí của 1 hồ sơ (join Candidate, Job). Null nếu không thấy.</summary>
    Task<ApplicationContactInfo?> GetContactInfoAsync(long companyId, long applicationId);
}
