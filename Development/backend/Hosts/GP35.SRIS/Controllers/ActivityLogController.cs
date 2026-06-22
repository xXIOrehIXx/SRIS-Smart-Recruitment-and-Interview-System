using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Lịch sử hồ sơ (audit "ai làm gì lúc nào" — docs 5.6): chuyển state, tạo lịch PV, ra offer,
/// ứng viên chốt lịch/offer... Nội bộ — Recruiter/Interviewer/DM xem.
/// </summary>
[Route("api/applications/{applicationId:long}/history")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter, RoleConstants.Interviewer, RoleConstants.DepartmentManager)]
public class ActivityLogController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IActivityLogService _activityLogService;

    public ActivityLogController(IContextData contextData, IActivityLogService activityLogService)
    {
        _contextData = contextData;
        _activityLogService = activityLogService;
    }

    /// <summary>Timeline hoạt động của hồ sơ (theo thứ tự thời gian).</summary>
    [HttpGet]
    public async Task<IActionResult> GetHistory(long applicationId)
    {
        var result = await _activityLogService.GetHistoryAsync(_contextData.CompanyId, applicationId);
        return Ok(result);
    }
}
