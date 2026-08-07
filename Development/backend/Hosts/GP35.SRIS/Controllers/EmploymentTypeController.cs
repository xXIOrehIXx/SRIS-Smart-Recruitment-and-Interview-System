using GP35.SRIS.Application.Contracts.Dtos.Business.EmploymentType;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Danh mục hình thức làm việc (V027): Admin dựng sân (CRUD); mọi role đăng nhập đọc được
/// để đổ dropdown (Human Resource tạo Job, DM tạo Yêu cầu tuyển dụng).
/// </summary>
[ApiController]
[Authorize]
[Route("api/employment-types")]
public class EmploymentTypeController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IEmploymentTypeService _employmentTypeService;

    public EmploymentTypeController(IContextData contextData, IEmploymentTypeService employmentTypeService)
    {
        _contextData = contextData;
        _employmentTypeService = employmentTypeService;
    }

    /// <summary>Danh sách hình thức làm việc (A→Z, kèm số job đang dùng). Mọi role đăng nhập.</summary>
    [HttpGet]
    public async Task<IActionResult> GetList()
    {
        return Ok(await _employmentTypeService.GetListAsync(_contextData.CompanyId));
    }

    /// <summary>Chi tiết 1 hình thức làm việc.</summary>
    [HttpGet("{employmentTypeId:long}")]
    public async Task<IActionResult> GetById(long employmentTypeId)
    {
        return Ok(await _employmentTypeService.GetByIdAsync(_contextData.CompanyId, employmentTypeId));
    }

    /// <summary>Admin tạo hình thức làm việc mới.</summary>
    [HttpPost]
    [WithRole(RoleConstants.Admin)]
    public async Task<IActionResult> Create([FromBody] EmploymentTypeInputDto dto)
    {
        return Ok(await _employmentTypeService.CreateAsync(_contextData.CompanyId, dto));
    }

    /// <summary>Admin sửa — đổi tên sẽ đồng bộ tên trong Job/Yêu cầu tuyển dụng.</summary>
    [HttpPut("{employmentTypeId:long}")]
    [WithRole(RoleConstants.Admin)]
    public async Task<IActionResult> Update(long employmentTypeId, [FromBody] EmploymentTypeInputDto dto)
    {
        return Ok(await _employmentTypeService.UpdateAsync(_contextData.CompanyId, employmentTypeId, dto));
    }

    /// <summary>Admin xóa — chặn khi còn job dùng (đổi Inactive thay thế).</summary>
    [HttpDelete("{employmentTypeId:long}")]
    [WithRole(RoleConstants.Admin)]
    public async Task<IActionResult> Delete(long employmentTypeId)
    {
        await _employmentTypeService.DeleteAsync(_contextData.CompanyId, employmentTypeId);
        return NoContent();
    }
}
