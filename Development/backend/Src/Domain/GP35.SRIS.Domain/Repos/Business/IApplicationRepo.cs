using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 card trên Kanban: hồ sơ + ứng viên.</summary>
public record ApplicationBoardRow(
    long ApplicationId, long CandidateId, string CandidateName, string CandidateEmail,
    string CurrentState, long CvId, DateTime? AppliedAt);

/// <summary>Chi tiết 1 hồ sơ cho màn xem ứng viên (join Candidate + Job + CvDocument).</summary>
public record ApplicationDetailRow(
    long ApplicationId, string CurrentState,
    string? RejectReason, DateTime? AppliedAt, DateTime? StageUpdatedAt,
    long CandidateId, string CandidateName, string CandidateEmail, string? CandidatePhone, string? CandidateSource,
    long JobId, string JobTitle,
    long CvId, string? CvFileName, string CvParseStatus);

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

    /// <summary>Toàn bộ hồ sơ của 1 job cho Kanban (mới nộp trước trong từng cột).</summary>
    Task<IReadOnlyList<ApplicationBoardRow>> GetBoardByJobAsync(long companyId, long jobId);

    /// <summary>Chi tiết 1 hồ sơ (join Candidate + Job + CvDocument). Null nếu không thuộc company.</summary>
    Task<ApplicationDetailRow?> GetDetailAsync(long companyId, long applicationId);

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
