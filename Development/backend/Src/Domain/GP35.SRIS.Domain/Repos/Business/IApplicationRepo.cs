using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// 1 card trên Kanban: hồ sơ + ứng viên + kết quả sàng lọc CV gần nhất (V046).
///
/// <para>
/// Ba trường sàng lọc là LEFT JOIN sang <c>CvScreening</c>: hồ sơ chưa phân tích bao giờ thì
/// <see cref="ScreeningStatus"/> = null, KHÔNG phải điểm 0. Phân biệt "chưa chấm" với "chấm
/// thấp" là bắt buộc — gộp hai ca đó lại thì hồ sơ chưa ai đọc bị đẩy xuống đáy y như hồ sơ
/// đã đọc và thấy không hợp.
/// </para>
/// </summary>
public record ApplicationBoardRow(
    long ApplicationId, long CandidateId, string CandidateName, string CandidateEmail,
    string CurrentState, long CvId, DateTime? AppliedAt,
    string? ScreeningStatus, int? FitScore, string? ScreeningDecision);

/// <summary>Thứ tự trả về của bảng Kanban.</summary>
public enum BoardSort
{
    /// <summary>Mới nộp trước (mặc định — thứ tự vốn có của hệ thống).</summary>
    Recent = 0,

    /// <summary>
    /// Mức phù hợp CV↔JD cao trước, hồ sơ CHƯA phân tích xếp sau cùng (V046).
    /// Dùng cho màn sàng lọc: người tuyển dụng đọc trước những CV AI thấy khớp nhất.
    /// </summary>
    Fit = 1
}

/// <summary>
/// 1 dòng của file Excel danh sách ứng viên (V047). Gộp thông tin liên hệ + trạng thái + kết
/// quả AI đọc CV để người tuyển dụng mang ra ngoài hệ thống (họp, gửi sếp) mà không phải gõ lại.
/// </summary>
public record ApplicationExportRow(
    long ApplicationId, string CandidateName, string CandidateEmail, string? CandidatePhone,
    string? CandidateSource, string CurrentState, string? RejectReason, DateTime? AppliedAt,
    string? CvFileName,
    string? ScreeningStatus, int? FitScore, string? ScreeningDecision,
    string? ScreeningSummary, string? MatchedJson, string? MissingJson);

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

    /// <summary>
    /// Mọi hồ sơ của 1 job kèm liên hệ + kết quả sàng lọc CV, để xuất file Excel (V047).
    /// Thứ tự: điểm phù hợp cao trước, hồ sơ chưa phân tích xuống cuối — giống <see cref="BoardSort.Fit"/>,
    /// vì file mang đi họp nên đọc từ trên xuống phải là thứ tự đáng đọc.
    /// </summary>
    Task<IReadOnlyList<ApplicationExportRow>> GetExportRowsByJobAsync(long companyId, long jobId);

    /// <summary>
    /// Toàn bộ hồ sơ của 1 job cho Kanban, kèm kết quả sàng lọc CV gần nhất.
    /// <paramref name="sort"/> quyết định thứ tự trong từng cột (FE nhóm theo state, giữ nguyên
    /// thứ tự trả về).
    /// </summary>
    Task<IReadOnlyList<ApplicationBoardRow>> GetBoardByJobAsync(
        long companyId, long jobId, BoardSort sort = BoardSort.Recent);

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
