using GP35.SRIS.Application.Contracts.Dtos.Business.User;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>Admin quản lý tài khoản nội bộ của công ty (docs 2 — "Quản lý user, gán role").</summary>
[Route("api/users")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.Admin)]
public class UsersController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IUserManageService _userManage;

    public UsersController(IContextData contextData, IUserManageService userManage)
    {
        _contextData = contextData;
        _userManage = userManage;
    }

    /// <summary>Danh sách tài khoản nội bộ của công ty.</summary>
    [HttpGet]
    public async Task<IActionResult> List()
    {
        return Ok(await _userManage.GetListAsync(_contextData.CompanyId));
    }

    /// <summary>Chi tiết 1 tài khoản.</summary>
    [HttpGet("{userId:long}")]
    public async Task<IActionResult> GetById(long userId)
    {
        return Ok(await _userManage.GetByIdAsync(_contextData.CompanyId, userId));
    }

    /// <summary>Tạo tài khoản nội bộ mới.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UserCreateDto dto)
    {
        return Ok(await _userManage.CreateAsync(_contextData.CompanyId, dto));
    }

    /// <summary>Sửa tài khoản (đổi role, khóa/mở).</summary>
    [HttpPut("{userId:long}")]
    public async Task<IActionResult> Update(long userId, [FromBody] UserUpdateDto dto)
    {
        return Ok(await _userManage.UpdateAsync(_contextData.CompanyId, userId, dto));
    }

    /// <summary>Đặt lại mật khẩu 1 tài khoản (Admin reset).</summary>
    [HttpPost("{userId:long}/reset-password")]
    public async Task<IActionResult> ResetPassword(long userId, [FromBody] UserPasswordDto dto)
    {
        await _userManage.ResetPasswordAsync(_contextData.CompanyId, userId, dto.NewPassword);
        return Ok(new { message = "Đã đặt lại mật khẩu." });
    }
}
