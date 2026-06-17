using GP35.SRIS.Application.Contracts.Dtos.Ai;

namespace GP35.SRIS.Application.Contracts.Services.Ai;

/// <summary>
/// "Bộ não" điều phối luồng chấm điểm CV bằng vector:
/// PDF -> text -> embedding -> lưu DB -> VECTOR_DISTANCE -> điểm 0-100.
/// </summary>
public interface ICvScoringService : IBaseService
{
    /// <summary>Nộp CV dạng FILE PDF và chấm điểm.</summary>
    Task<CvScoreResultDto> ScoreUploadedCvAsync(
        long companyId, long jobId, string candidateName, string candidateEmail,
        string fileName, string? mimeType, byte[] fileBytes);

    /// <summary>Nộp CV dạng TEXT và chấm điểm.</summary>
    Task<CvScoreResultDto> ScoreCvTextAsync(long companyId, CvScoreTextRequest request);

    /// <summary>Bảng xếp hạng ứng viên của 1 job theo điểm giảm dần.</summary>
    Task<IEnumerable<CandidateRankingDto>> GetRankingAsync(long companyId, long jobId);

    /// <summary>
    /// Tạo URL tải tạm thời (presigned) để tải lại file CV gốc của 1 cv_id.
    /// Trả về null nếu CV không tồn tại hoặc không có file gốc.
    /// </summary>
    Task<string?> GetCvFileUrlAsync(long companyId, long cvId);
}
