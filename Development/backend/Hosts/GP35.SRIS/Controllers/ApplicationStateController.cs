using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// State machine hồ sơ (docs 5.8) — Recruiter thao tác Kanban; ở cửa INTERVIEW→OFFER là điểm
/// quyết tuyển (Department Manager / Recruiter mặc định). Forward-only + guard G1/G2 + reject reason.
/// </summary>
[Route("api/applications/{applicationId:long}")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter, RoleConstants.DepartmentManager)]
public class ApplicationStateController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IApplicationStateService _stateService;

    public ApplicationStateController(IContextData contextData, IApplicationStateService stateService)
    {
        _contextData = contextData;
        _stateService = stateService;
    }

    /// <summary>Chuyển hồ sơ sang state đích (gồm REJECTED). Reason bắt buộc khi reject.</summary>
    [HttpPost("transition")]
    public async Task<IActionResult> Transition(long applicationId, [FromBody] TransitionRequestDto dto)
    {
        var result = await _stateService.TransitionAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, dto.ToState, dto.Reason);
        return Ok(result);
    }

    /// <summary>Loại hồ sơ (REJECTED) — tiện ích, reason bắt buộc (5.7).</summary>
    [HttpPost("reject")]
    public async Task<IActionResult> Reject(long applicationId, [FromBody] RejectRequestDto dto)
    {
        var result = await _stateService.RejectAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, dto.Reason);
        return Ok(result);
    }
}
