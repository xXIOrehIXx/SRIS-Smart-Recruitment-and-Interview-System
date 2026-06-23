using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Thư viện tiêu chí mẫu cấp company (Việc 12). Recruiter tạo khuôn 1 lần rồi ÁP vào job —
/// clone từng dòng thành EvaluationCriteria của job (không tham chiếu, sửa riêng sau được).
/// </summary>
public interface ICriteriaTemplateService : IBaseService
{
    Task<CriteriaTemplateDto> CreateAsync(long companyId, CriteriaTemplateInputDto dto);

    /// <summary>Danh sách khuôn (rút gọn, kèm số dòng). includeInactive=false chỉ trả khuôn đang bật.</summary>
    Task<IReadOnlyList<CriteriaTemplateSummaryDto>> GetAllAsync(long companyId, bool includeInactive = false);

    /// <summary>1 khuôn kèm dòng. Null nếu không tồn tại trong company.</summary>
    Task<CriteriaTemplateDto?> GetByIdAsync(long companyId, long templateId);

    Task<CriteriaTemplateDto> UpdateAsync(long companyId, long templateId, CriteriaTemplateUpdateDto dto);

    /// <summary>Ẩn 1 khuôn (không xoá cứng). Trả false nếu không tìm thấy.</summary>
    Task<bool> DeactivateAsync(long companyId, long templateId);

    /// <summary>
    /// Áp khuôn vào 1 job: clone từng dòng thành EvaluationCriteria của job. Trả danh sách tiêu chí vừa tạo.
    /// </summary>
    Task<IReadOnlyList<CriteriaDto>> ApplyToJobAsync(long companyId, long templateId, long jobId);
}
