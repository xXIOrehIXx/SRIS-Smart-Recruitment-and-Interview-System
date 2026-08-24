using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Tiêu chí đánh giá per-job (docs 5.7, 5.18) — bộ khung để interviewer chấm phỏng vấn.
/// CRUD + AI bóc DRAFT từ JD + người duyệt chốt APPROVED.
///
/// <para><b>Trưởng bộ phận vào được (24/08/2026):</b> họ là người RA ĐỀ cho vị trí của bộ phận
/// mình, nên bóc tiêu chí bằng AI và chốt bộ tiêu chí là việc của họ. Nhân sự giữ nguyên quyền cũ
/// (công ty nhỏ hay nhờ nhân sự nhập hộ). Ràng buộc "đúng vị trí mình phụ trách" của DM nằm ở
/// tầng service — <c>JobCriteriaAccessGuard</c>, không phải ở đây, vì attribute này chỉ biết role.</para>
/// </summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager)]
public class EvaluationCriteriaController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IEvaluationCriteriaService _criteriaService;

    public EvaluationCriteriaController(
        IContextData contextData,
        IEvaluationCriteriaService criteriaService)
    {
        _contextData = contextData;
        _criteriaService = criteriaService;
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

    /// <summary>Gỡ 1 tiêu chí khỏi job (soft — active=0).</summary>
    [HttpDelete("api/evaluation-criteria/{criteriaId:long}")]
    public async Task<IActionResult> Delete(long criteriaId)
    {
        await _criteriaService.DeactivateAsync(_contextData.CompanyId, criteriaId);
        return NoContent();
    }

    /// <summary>
    /// XẾP HÀNG một lượt AI bóc tiêu chí từ JD (Local LLM — 5.18). Trả 202 ngay, KHÔNG đợi AI:
    /// Local LLM chạy CPU mất hàng chục giây nên đây là tác vụ nền (V037). FE hỏi lại
    /// <c>GET .../criteria/extract-status</c> cho tới khi <c>running=false</c>.
    /// </summary>
    [HttpPost("api/jobs/{jobId:long}/criteria/extract")]
    public async Task<IActionResult> Extract(long jobId)
    {
        var status = await _criteriaService.RequestExtractAsync(
            _contextData.CompanyId, jobId, _contextData.UserId);
        return Accepted(status);
    }

    /// <summary>
    /// Trạng thái lượt bóc gần nhất của job. <c>running=true</c> -> FE hỏi lại sau vài giây;
    /// <c>DONE</c> -> nạp lại danh sách tiêu chí; <c>FAILED</c> -> hiện <c>errorMessage</c>.
    /// </summary>
    [HttpGet("api/jobs/{jobId:long}/criteria/extract-status")]
    public async Task<IActionResult> ExtractStatus(long jobId)
    {
        return Ok(await _criteriaService.GetExtractStatusAsync(_contextData.CompanyId, jobId));
    }

    /// <summary>Người duyệt chốt bộ tiêu chí: mọi DRAFT của job -> APPROVED (ghi audit ai duyệt).</summary>
    [HttpPost("api/jobs/{jobId:long}/criteria/approve")]
    public async Task<IActionResult> Approve(long jobId)
    {
        var approved = await _criteriaService.ApproveDraftsAsync(
            _contextData.CompanyId, jobId, _contextData.UserId);
        return Ok(new { approved });
    }
}
