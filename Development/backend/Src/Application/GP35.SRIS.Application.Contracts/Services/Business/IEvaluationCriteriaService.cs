using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Tiêu chí đánh giá theo job (docs 5.7, 5.18) — trục xuyên suốt từ lọc CV đến phỏng vấn.
/// Luồng: người gõ trực tiếp HOẶC AI bóc từ JD (DRAFT) -> người duyệt chốt (APPROVED).
/// </summary>
public interface IEvaluationCriteriaService : IBaseService
{
    Task<CriteriaDto> CreateAsync(long companyId, long jobId, CriteriaInputDto dto);

    /// <summary>
    /// Tiêu chí của job. includeInactive=false (mặc định) chỉ trả tiêu chí đang bật.
    /// Luôn trả CẢ DRAFT (kèm status) — màn duyệt cần thấy; chấm CV/phỏng vấn tự lọc APPROVED.
    /// </summary>
    Task<IReadOnlyList<CriteriaDto>> GetByJobAsync(long companyId, long jobId, bool includeInactive = false);

    Task<CriteriaDto> UpdateAsync(long companyId, long criteriaId, CriteriaUpdateDto dto);

    /// <summary>
    /// AI bóc tiêu chí từ JD của job (Local LLM — 5.18) -> lưu DRAFT (thay DRAFT cũ nếu có).
    /// AI KHÔNG quyết tiêu chí — người duyệt sửa/thêm-bớt rồi gọi <see cref="ApproveDraftsAsync"/>.
    /// AI service lỗi -> ném lỗi 502 để FE hiện fallback nhập tay.
    /// </summary>
    Task<IReadOnlyList<CriteriaDto>> ExtractDraftAsync(long companyId, long jobId);

    /// <summary>Người duyệt chốt: mọi DRAFT của job -> APPROVED (ghi ai duyệt, lúc nào). Trả số tiêu chí được duyệt.</summary>
    Task<int> ApproveDraftsAsync(long companyId, long jobId, long userId);
}
