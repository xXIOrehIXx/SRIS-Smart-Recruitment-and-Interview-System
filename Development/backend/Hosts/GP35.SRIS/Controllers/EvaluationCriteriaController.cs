using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Tiêu chí đánh giá per-job (docs 5.7, 5.18) — trục xuyên suốt từ lọc CV đến phỏng vấn.
/// CRUD + AI bóc DRAFT từ JD + duyệt + xem kết quả khớp/thiếu của từng hồ sơ.
/// </summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter)]
public class EvaluationCriteriaController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IEvaluationCriteriaService _criteriaService;
    private readonly ICriteriaScoringService _criteriaScoring;

    public EvaluationCriteriaController(
        IContextData contextData,
        IEvaluationCriteriaService criteriaService,
        ICriteriaScoringService criteriaScoring)
    {
        _contextData = contextData;
        _criteriaService = criteriaService;
        _criteriaScoring = criteriaScoring;
    }

    /// <summary>Thêm 1 tiêu chí cho job (người gõ trực tiếp -> APPROVED luôn).</summary>
    [HttpPost("api/jobs/{jobId:long}/criteria")]
    public async Task<IActionResult> Create(long jobId, [FromBody] CriteriaInputDto dto)
    {
        return Ok(await _criteriaService.CreateAsync(_contextData.CompanyId, jobId, dto));
    }

    /// <summary>Tiêu chí của job (gồm cả DRAFT chờ duyệt — FE phân biệt qua status).</summary>
    [HttpGet("api/jobs/{jobId:long}/criteria")]
    public async Task<IActionResult> GetByJob(long jobId, [FromQuery] bool includeInactive = false)
    {
        return Ok(await _criteriaService.GetByJobAsync(_contextData.CompanyId, jobId, includeInactive));
    }

    /// <summary>Sửa 1 tiêu chí (gồm bật/tắt, phân loại HARD/SOFT, keywords).</summary>
    [HttpPut("api/evaluation-criteria/{criteriaId:long}")]
    public async Task<IActionResult> Update(long criteriaId, [FromBody] CriteriaUpdateDto dto)
    {
        return Ok(await _criteriaService.UpdateAsync(_contextData.CompanyId, criteriaId, dto));
    }

    /// <summary>
    /// AI bóc tiêu chí từ JD của job (Local LLM — 5.18) -> danh sách DRAFT chờ duyệt.
    /// AI/Ollama lỗi -> 502 AI_EXTRACT_FAILED, FE hiện fallback nhập tay.
    /// </summary>
    [HttpPost("api/jobs/{jobId:long}/criteria/extract")]
    public async Task<IActionResult> Extract(long jobId)
    {
        return Ok(await _criteriaService.ExtractDraftAsync(_contextData.CompanyId, jobId));
    }

    /// <summary>Người duyệt chốt bộ tiêu chí: mọi DRAFT của job -> APPROVED (ghi audit ai duyệt).</summary>
    [HttpPost("api/jobs/{jobId:long}/criteria/approve")]
    public async Task<IActionResult> Approve(long jobId)
    {
        var approved = await _criteriaService.ApproveDraftsAsync(
            _contextData.CompanyId, jobId, _contextData.UserId);
        return Ok(new { approved });
    }

    /// <summary>Bảng khớp/thiếu + bằng chứng + điểm theo tiêu chí của 1 hồ sơ (màn sàng lọc).</summary>
    [HttpGet("api/applications/{applicationId:long}/criteria-matches")]
    public async Task<IActionResult> GetMatches(long applicationId)
    {
        return Ok(await _criteriaScoring.GetMatchesAsync(_contextData.CompanyId, applicationId));
    }

    /// <summary>
    /// Chấm lại 1 hồ sơ theo bộ tiêu chí hiện tại (gọi sau khi duyệt/sửa tiêu chí
    /// để cập nhật kết quả cho hồ sơ đã nộp trước đó).
    /// </summary>
    [HttpPost("api/applications/{applicationId:long}/criteria-score")]
    public async Task<IActionResult> Rescore(long applicationId)
    {
        await _criteriaScoring.ScoreByCriteriaAsync(_contextData.CompanyId, applicationId);
        return Ok(await _criteriaScoring.GetMatchesAsync(_contextData.CompanyId, applicationId));
    }
}
