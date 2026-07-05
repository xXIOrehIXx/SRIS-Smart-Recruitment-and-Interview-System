using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>Đọc hồ sơ ứng tuyển cho Kanban + màn chi tiết ứng viên (5.16). Recruiter/DM.</summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter, RoleConstants.DepartmentManager)]
public class ApplicationQueryController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IApplicationQueryService _queryService;

    public ApplicationQueryController(IContextData contextData, IApplicationQueryService queryService)
    {
        _contextData = contextData;
        _queryService = queryService;
    }

    /// <summary>Toàn bộ hồ sơ của 1 job cho Kanban (FE nhóm theo state thành 4 pha).</summary>
    [HttpGet("api/jobs/{jobId:long}/applications")]
    public async Task<IActionResult> GetByJob(long jobId)
    {
        return Ok(await _queryService.GetBoardByJobAsync(_contextData.CompanyId, jobId));
    }

    /// <summary>Chi tiết 1 hồ sơ ứng viên.</summary>
    [HttpGet("api/applications/{applicationId:long}")]
    public async Task<IActionResult> GetById(long applicationId)
    {
        return Ok(await _queryService.GetDetailAsync(_contextData.CompanyId, applicationId));
    }
}
