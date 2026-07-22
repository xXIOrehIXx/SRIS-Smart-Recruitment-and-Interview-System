using GP35.SRIS.Application.Contracts.Dtos.Business.Department;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Danh mục phòng ban (V022): Admin dựng sân (CRUD); mọi role đăng nhập đọc được
/// để đổ dropdown (Recruiter tạo Job, DM tạo Yêu cầu tuyển dụng).
/// </summary>
[ApiController]
[Authorize]
[Route("api/departments")]
public class DepartmentController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IDepartmentService _departmentService;

    public DepartmentController(IContextData contextData, IDepartmentService departmentService)
    {
        _contextData = contextData;
        _departmentService = departmentService;
    }

    /// <summary>Danh sách phòng ban (A→Z, kèm số job đang dùng). Mọi role đăng nhập.</summary>
    [HttpGet]
    public async Task<IActionResult> GetList()
    {
        return Ok(await _departmentService.GetListAsync(_contextData.CompanyId));
    }

    /// <summary>Chi tiết 1 phòng ban.</summary>
    [HttpGet("{departmentId:long}")]
    public async Task<IActionResult> GetById(long departmentId)
    {
        return Ok(await _departmentService.GetByIdAsync(_contextData.CompanyId, departmentId));
    }

    /// <summary>Admin tạo phòng ban mới.</summary>
    [HttpPost]
    [WithRole(RoleConstants.Admin)]
    public async Task<IActionResult> Create([FromBody] DepartmentInputDto dto)
    {
        return Ok(await _departmentService.CreateAsync(_contextData.CompanyId, dto));
    }

    /// <summary>Admin sửa phòng ban — đổi tên sẽ đồng bộ tên trong Job/Yêu cầu tuyển dụng.</summary>
    [HttpPut("{departmentId:long}")]
    [WithRole(RoleConstants.Admin)]
    public async Task<IActionResult> Update(long departmentId, [FromBody] DepartmentInputDto dto)
    {
        return Ok(await _departmentService.UpdateAsync(_contextData.CompanyId, departmentId, dto));
    }

    /// <summary>Admin xóa phòng ban — chặn khi còn job dùng (đổi Inactive thay thế).</summary>
    [HttpDelete("{departmentId:long}")]
    [WithRole(RoleConstants.Admin)]
    public async Task<IActionResult> Delete(long departmentId)
    {
        await _departmentService.DeleteAsync(_contextData.CompanyId, departmentId);
        return NoContent();
    }
}
