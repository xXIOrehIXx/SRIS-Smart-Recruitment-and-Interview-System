using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Thư viện tiêu chí mẫu cấp company (Việc 12). Recruiter CRUD khuôn rồi áp vào job —
/// clone thành EvaluationCriteria của job (xem EvaluationCriteriaController để sửa per-job sau).
/// </summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter)]
[Route("api/criteria-templates")]
public class CriteriaTemplateController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly ICriteriaTemplateService _templateService;

    public CriteriaTemplateController(IContextData contextData, ICriteriaTemplateService templateService)
    {
        _contextData = contextData;
        _templateService = templateService;
    }

    /// <summary>Tạo 1 khuôn tiêu chí mới.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CriteriaTemplateInputDto dto)
    {
        return Ok(await _templateService.CreateAsync(_contextData.CompanyId, dto));
    }

    /// <summary>Danh sách khuôn (rút gọn, kèm số dòng).</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
    {
        return Ok(await _templateService.GetAllAsync(_contextData.CompanyId, includeInactive));
    }

    /// <summary>1 khuôn kèm dòng.</summary>
    [HttpGet("{templateId:long}")]
    public async Task<IActionResult> GetById(long templateId)
    {
        var dto = await _templateService.GetByIdAsync(_contextData.CompanyId, templateId);
        if (dto is null)
            return NotFound(new { error = $"Không tìm thấy khuôn tiêu chí (template_id={templateId})." });
        return Ok(dto);
    }

    /// <summary>Sửa khuôn (header + thay toàn bộ dòng + bật/tắt).</summary>
    [HttpPut("{templateId:long}")]
    public async Task<IActionResult> Update(long templateId, [FromBody] CriteriaTemplateUpdateDto dto)
    {
        return Ok(await _templateService.UpdateAsync(_contextData.CompanyId, templateId, dto));
    }

    /// <summary>Ẩn 1 khuôn (không xoá cứng).</summary>
    [HttpDelete("{templateId:long}")]
    public async Task<IActionResult> Deactivate(long templateId)
    {
        var ok = await _templateService.DeactivateAsync(_contextData.CompanyId, templateId);
        if (!ok)
            return NotFound(new { error = $"Không tìm thấy khuôn tiêu chí (template_id={templateId})." });
        return NoContent();
    }

    /// <summary>Áp khuôn vào 1 job: clone từng dòng thành tiêu chí của job. Trả tiêu chí vừa tạo.</summary>
    [HttpPost("{templateId:long}/apply/{jobId:long}")]
    public async Task<IActionResult> ApplyToJob(long templateId, long jobId)
    {
        return Ok(await _templateService.ApplyToJobAsync(_contextData.CompanyId, templateId, jobId));
    }
}
