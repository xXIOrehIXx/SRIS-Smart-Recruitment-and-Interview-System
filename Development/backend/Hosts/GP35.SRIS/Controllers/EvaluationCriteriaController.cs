using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>Tiêu chí chấm phỏng vấn per-job (docs 5.7) — Recruiter cấu hình (CRUD).</summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter)]
public class EvaluationCriteriaController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IEvaluationCriteriaService _criteriaService;

    public EvaluationCriteriaController(IContextData contextData, IEvaluationCriteriaService criteriaService)
    {
        _contextData = contextData;
        _criteriaService = criteriaService;
    }

    /// <summary>Thêm 1 tiêu chí cho job.</summary>
    [HttpPost("api/jobs/{jobId:long}/criteria")]
    public async Task<IActionResult> Create(long jobId, [FromBody] CriteriaInputDto dto)
    {
        return Ok(await _criteriaService.CreateAsync(_contextData.CompanyId, jobId, dto));
    }

    /// <summary>Tiêu chí của job (mặc định chỉ tiêu chí đang bật).</summary>
    [HttpGet("api/jobs/{jobId:long}/criteria")]
    public async Task<IActionResult> GetByJob(long jobId, [FromQuery] bool includeInactive = false)
    {
        return Ok(await _criteriaService.GetByJobAsync(_contextData.CompanyId, jobId, includeInactive));
    }

    /// <summary>Sửa 1 tiêu chí (gồm bật/tắt).</summary>
    [HttpPut("api/evaluation-criteria/{criteriaId:long}")]
    public async Task<IActionResult> Update(long criteriaId, [FromBody] CriteriaUpdateDto dto)
    {
        return Ok(await _criteriaService.UpdateAsync(_contextData.CompanyId, criteriaId, dto));
    }
}
