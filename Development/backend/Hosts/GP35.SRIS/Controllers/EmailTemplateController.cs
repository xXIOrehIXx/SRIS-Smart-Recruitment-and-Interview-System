using GP35.SRIS.Application.Contracts.Dtos.EmailTemplate;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// CRUD template email động (M4) — Recruiter cấu hình nội dung email tự động theo từng loại trigger
/// (state machine + magic link). Admin bypass [WithRole]. Cô lập tenant qua IContextData.CompanyId.
/// </summary>
[Route("api/email-templates")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter)]
public class EmailTemplateController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IEmailTemplateService _service;

    public EmailTemplateController(IContextData contextData, IEmailTemplateService service)
    {
        _contextData = contextData;
        _service = service;
    }

    /// <summary>Danh sách template của công ty (nhóm theo loại).</summary>
    [HttpGet]
    public async Task<IActionResult> List()
        => Ok(await _service.GetListAsync(_contextData.CompanyId));

    [HttpGet("{templateId:long}")]
    public async Task<IActionResult> Get(long templateId)
        => Ok(await _service.GetByIdAsync(_contextData.CompanyId, templateId));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] EmailTemplateUpsertDto dto)
        => Ok(await _service.CreateAsync(_contextData.CompanyId, dto));

    [HttpPut("{templateId:long}")]
    public async Task<IActionResult> Update(long templateId, [FromBody] EmailTemplateUpsertDto dto)
        => Ok(await _service.UpdateAsync(_contextData.CompanyId, templateId, dto));

    [HttpDelete("{templateId:long}")]
    public async Task<IActionResult> Delete(long templateId)
    {
        await _service.DeleteAsync(_contextData.CompanyId, templateId);
        return NoContent();
    }
}
