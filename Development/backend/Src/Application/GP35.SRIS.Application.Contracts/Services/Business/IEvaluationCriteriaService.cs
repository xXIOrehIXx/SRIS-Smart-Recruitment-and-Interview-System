using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>CRUD tiêu chí chấm phỏng vấn theo job (docs 5.7) — Recruiter tự định nghĩa, không hard-code.</summary>
public interface IEvaluationCriteriaService : IBaseService
{
    Task<CriteriaDto> CreateAsync(long companyId, long jobId, CriteriaInputDto dto);

    /// <summary>Tiêu chí của job. includeInactive=false (mặc định) chỉ trả tiêu chí đang bật.</summary>
    Task<IReadOnlyList<CriteriaDto>> GetByJobAsync(long companyId, long jobId, bool includeInactive = false);

    Task<CriteriaDto> UpdateAsync(long companyId, long criteriaId, CriteriaUpdateDto dto);
}
