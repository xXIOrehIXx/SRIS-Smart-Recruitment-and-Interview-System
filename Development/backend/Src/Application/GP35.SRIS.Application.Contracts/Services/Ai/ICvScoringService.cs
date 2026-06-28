using GP35.SRIS.Application.Contracts.Dtos.Ai;

namespace GP35.SRIS.Application.Contracts.Services.Ai;

/// <summary>
/// "Bộ não" điều phối luồng chấm điểm CV bằng vector:
/// PDF -> text -> embedding -> lưu DB -> VECTOR_DISTANCE -> điểm 0-100.
/// </summary>
public interface ICvScoringService : IBaseService
{
    /// <summary>
    /// Nộp CV dạng FILE PDF. Cách A (chấm nền): lưu CV + hồ sơ (NEW, chưa điểm), đẩy vào hàng đợi rồi
    /// trả về NGAY với Status = PENDING (KHÔNG đợi AI). File hỏng / scan ảnh / job thiếu JD -> trả luôn
    /// FAILED / NEEDS_MANUAL_EDIT (không tạo hồ sơ).
    /// </summary>
    Task<CvScoreResultDto> ScoreUploadedCvAsync(
        long companyId, long jobId, string candidateName, string candidateEmail, string? candidatePhone,
        string fileName, string? mimeType, byte[] fileBytes);

    /// <summary>
    /// (Cách A) Chấm điểm NGẦM cho 1 hồ sơ đã nộp: embed CV + lazy embed JD + VECTOR_DISTANCE + lưu điểm.
    /// Gọi bởi worker nền (<c>CvScoringWorker</c>), KHÔNG nằm trong request nộp CV. Lỗi AI -> để điểm NULL,
    /// lần khởi động sau worker tự vớt chấm lại.
    /// </summary>
    Task ScoreApplicationAsync(long companyId, long applicationId);

    /// <summary>Bảng xếp hạng ứng viên của 1 job theo điểm giảm dần.</summary>
    Task<IEnumerable<CandidateRankingDto>> GetRankingAsync(long companyId, long jobId);

    /// <summary>
    /// Tạo URL tải tạm thời (presigned) để tải lại file CV gốc của 1 cv_id.
    /// Trả về null nếu CV không tồn tại hoặc không có file gốc.
    /// </summary>
    Task<string?> GetCvFileUrlAsync(long companyId, long cvId);
}
