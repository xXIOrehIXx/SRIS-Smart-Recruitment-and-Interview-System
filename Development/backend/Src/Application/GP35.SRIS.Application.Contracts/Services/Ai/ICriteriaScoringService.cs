using GP35.SRIS.Application.Contracts.Dtos.Ai.Criteria;

namespace GP35.SRIS.Application.Contracts.Services.Ai;

/// <summary>
/// Chấm CV theo TỪNG tiêu chí đã duyệt (docs 5.18): HARD lọc rule/keyword, SOFT so vector
/// tiêu chí ↔ đoạn CV, kết quả = khớp/thiếu + bằng chứng + điểm tổng có trọng số.
/// </summary>
public interface ICriteriaScoringService : IBaseService
{
    /// <summary>
    /// Chấm 1 hồ sơ theo bộ tiêu chí APPROVED của job. Job chưa có tiêu chí -> bỏ qua êm
    /// (điểm cả-CV ai_match_score vẫn hoạt động độc lập). Gọi từ worker nền sau khi embed CV.
    /// </summary>
    Task ScoreByCriteriaAsync(long companyId, long applicationId);

    /// <summary>Bảng khớp/thiếu + bằng chứng + điểm của 1 hồ sơ (màn sàng lọc đọc).</summary>
    Task<CriteriaMatchResultDto> GetMatchesAsync(long companyId, long applicationId);
}
