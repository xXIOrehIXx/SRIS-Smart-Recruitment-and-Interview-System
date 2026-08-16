using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Người phỏng vấn được chỉ định cho một ứng viên (V045 — chốt 16/08/2026).
///
/// Trưởng bộ phận chọn AI GẶP AI; bộ phận nhân sự chỉ ĐỌC danh sách này để đổ dropdown khi đặt
/// lịch (họ chốt giờ, không chốt người). Đường chính để chỉ định là nút "Duyệt vào phỏng vấn"
/// (kèm <c>interviewerIds</c> trong transition) — endpoint PUT ở đây dùng cho lần SỬA sau đó:
/// vòng 2 cần người khác, hoặc người được chỉ định nghỉ việc.
/// </summary>
[ApiController]
[Authorize]
[Route("api/applications/{applicationId:long}/interviewers")]
public class InterviewPanelController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IInterviewPanelService _panelService;

    public InterviewPanelController(IContextData contextData, IInterviewPanelService panelService)
    {
        _contextData = contextData;
        _panelService = panelService;
    }

    /// <summary>Danh sách người phỏng vấn đã chỉ định cho hồ sơ (rỗng = DM chưa chỉ định).</summary>
    [HttpGet]
    [WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager, RoleConstants.Director)]
    public async Task<IActionResult> Get(long applicationId)
    {
        return Ok(await _panelService.GetAsync(_contextData.CompanyId, applicationId));
    }

    /// <summary>
    /// Chỉ định (ghi đè) người phỏng vấn cho hồ sơ — body <c>{ interviewerIds: [] }</c>.
    /// Chỉ Trưởng bộ phận phụ trách vị trí (Admin bypass); service kiểm lại đúng người phụ trách.
    /// </summary>
    [HttpPut]
    [WithRole(RoleConstants.DepartmentManager)]
    public async Task<IActionResult> Assign(long applicationId, [FromBody] AssignInterviewersDto dto)
    {
        await _panelService.AssignAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId,
            dto.InterviewerIds ?? new List<long>());
        return NoContent();
    }
}
