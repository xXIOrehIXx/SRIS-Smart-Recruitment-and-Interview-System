using GP35.SRIS.Application.Contracts.Dtos.Ai;

namespace GP35.SRIS.Application.Contracts.Services.Ai;

/// <summary>
/// Talent Pool / CV Suggestion (Việc 13). Recruiter bấm "Gợi ý CV": đảo chiều vector search trên kho
/// CvDocument CŨ của công ty -> Top N CV gần JD nhất, lọc theo độ tươi. KHÔNG real-time, không gợi ý ngược.
/// </summary>
public interface ITalentPoolService : IBaseService
{
    /// <summary>
    /// Gợi ý ứng viên từ kho CV cũ cho 1 job. withinMonths = chỉ xét CV nộp trong N tháng gần đây
    /// (mặc định 6 — chuẩn "độ tươi" ngành; nới được). topN = số gợi ý.
    /// </summary>
    Task<TalentPoolResultDto> SuggestForJobAsync(long companyId, long jobId, int withinMonths, int topN);

    /// <summary>
    /// Gửi email mời ứng viên trong kho ứng tuyển vào 1 job (kèm link career site).
    /// Trả false nếu SMTP chưa cấu hình/gửi lỗi — FE hiện link để gửi tay.
    /// </summary>
    Task<bool> InviteAsync(long companyId, long jobId, string candidateEmail, string candidateName);
}
