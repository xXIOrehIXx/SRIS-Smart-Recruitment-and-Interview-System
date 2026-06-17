using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 dòng bảng xếp hạng ứng viên theo điểm.</summary>
public record ApplicationRankingRow(
    long ApplicationId,
    long CandidateId,
    string CandidateName,
    decimal? AiMatchScore,
    string CurrentState);

public interface IApplicationRepo : IBaseRepo<long, Application>
{
    /// <summary>Thêm hồ sơ ứng tuyển, trả về application_id vừa sinh.</summary>
    Task<long> InsertAsync(long companyId, Application application);

    /// <summary>
    /// Đo khoảng cách cosine giữa embedding của CV và của JD ngay trong SQL Server
    /// (VECTOR_DISTANCE). Khoảng cách nhỏ = giống nhiều.
    /// </summary>
    Task<double> GetCvJdCosineDistanceAsync(long companyId, long cvId, long jobId);

    /// <summary>Lưu điểm AI (0-100) vào hồ sơ.</summary>
    Task UpdateScoreAsync(long companyId, long applicationId, decimal score);

    /// <summary>Bảng xếp hạng ứng viên của 1 job theo điểm giảm dần.</summary>
    Task<IEnumerable<ApplicationRankingRow>> GetRankingByJobAsync(long companyId, long jobId);
}
