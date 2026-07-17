using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Dropdown chọn người cho Recruiter/DM (gán interviewer vào khung phỏng vấn, chọn DM cho job).
/// Tách khỏi UsersController vì bảng quản trị user đầy đủ chỉ dành cho Admin.
/// </summary>
[Route("api/users/options")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter, RoleConstants.DepartmentManager)]
public class UserOptionsController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IUserManageService _userManage;

    public UserOptionsController(IContextData contextData, IUserManageService userManage)
    {
        _contextData = contextData;
        _userManage = userManage;
    }

    /// <summary>User Active rút gọn; ?role=Interviewer/DepartmentManager/... để lọc, bỏ trống = tất cả.</summary>
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? role = null)
    {
        return Ok(await _userManage.GetOptionsAsync(_contextData.CompanyId, role));
    }
}
