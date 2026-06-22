using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Ghi chú nội bộ trên hồ sơ (docs "Activity Log & Internal Notes"). Nội bộ — Recruiter/Interviewer/DM
/// cộng tác, KHÔNG gửi ứng viên. Người viết = user đăng nhập.
/// </summary>
[Route("api/applications/{applicationId:long}/notes")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter, RoleConstants.Interviewer, RoleConstants.DepartmentManager)]
public class InternalNoteController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IInternalNoteService _noteService;

    public InternalNoteController(IContextData contextData, IInternalNoteService noteService)
    {
        _contextData = contextData;
        _noteService = noteService;
    }

    /// <summary>Thêm 1 ghi chú vào hồ sơ.</summary>
    [HttpPost]
    public async Task<IActionResult> Add(long applicationId, [FromBody] CreateNoteDto dto)
    {
        var result = await _noteService.AddAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, dto);
        return Ok(result);
    }

    /// <summary>Danh sách ghi chú của hồ sơ (mới nhất trước).</summary>
    [HttpGet]
    public async Task<IActionResult> GetByApplication(long applicationId)
    {
        var result = await _noteService.GetByApplicationAsync(_contextData.CompanyId, applicationId);
        return Ok(result);
    }
}
