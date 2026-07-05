using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Dashboard / Analytics (docs 4, M7): phễu tuyển dụng, time-to-hire, offer acceptance rate,
/// phân rã lý do loại + nguồn ứng viên. Số liệu quản trị — Recruiter & Department Manager xem.
/// </summary>
[Route("api/dashboard")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter, RoleConstants.DepartmentManager, RoleConstants.Admin)]
public class DashboardController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IDashboardService _dashboardService;

    public DashboardController(IContextData contextData, IDashboardService dashboardService)
    {
        _contextData = contextData;
        _dashboardService = dashboardService;
    }

    /// <summary>Tổng quan KPI. jobId rỗng = toàn công ty; truyền jobId = lọc theo 1 vị trí.</summary>
    [HttpGet("overview")]
    public async Task<IActionResult> Overview([FromQuery] long? jobId = null)
    {
        var result = await _dashboardService.GetOverviewAsync(_contextData.CompanyId, jobId);
        return Ok(result);
    }

    /// <summary>Kanban board cho recruitment pipeline. jobId rỗng = toàn công ty.</summary>
    [HttpGet("kanban")]
    public async Task<IActionResult> Kanban([FromQuery] long? jobId = null)
    {
        var result = await _dashboardService.GetKanbanBoardAsync(_contextData.CompanyId, jobId);
        return Ok(result);
    }
}
