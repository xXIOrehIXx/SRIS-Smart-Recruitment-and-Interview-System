using GP35.SRIS.Application.Contracts.Dtos.Business.Request;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Yêu cầu tuyển dụng (docs 5.17 — TÙY CHỌN): DM "ra đề" → Recruiter duyệt → tạo Job từ yêu cầu.
/// DM tạo/sửa/hủy (khi PENDING); Recruiter xem + duyệt + gắn job (Admin bypass qua WithRole).
/// </summary>
[ApiController]
[Authorize]
[Route("api/recruitment-requests")]
public class RecruitmentRequestController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IRecruitmentRequestService _requestService;

    public RecruitmentRequestController(IContextData contextData, IRecruitmentRequestService requestService)
    {
        _contextData = contextData;
        _requestService = requestService;
    }

    /// <summary>DM tạo yêu cầu tuyển dụng mới (PENDING).</summary>
    [HttpPost]
    [WithRole(RoleConstants.DepartmentManager)]
    public async Task<IActionResult> Create([FromBody] RecruitmentRequestInputDto dto)
    {
        return Ok(await _requestService.CreateAsync(_contextData.CompanyId, _contextData.UserId, dto));
    }

    /// <summary>Danh sách yêu cầu của công ty (?status=PENDING/... để lọc). DM + Recruiter cùng xem.</summary>
    [HttpGet]
    [WithRole(RoleConstants.DepartmentManager, RoleConstants.Recruiter)]
    public async Task<IActionResult> GetList([FromQuery] string? status = null)
    {
        return Ok(await _requestService.GetListAsync(_contextData.CompanyId, status));
    }

    /// <summary>Chi tiết 1 yêu cầu.</summary>
    [HttpGet("{requestId:long}")]
    [WithRole(RoleConstants.DepartmentManager, RoleConstants.Recruiter)]
    public async Task<IActionResult> GetById(long requestId)
    {
        return Ok(await _requestService.GetByIdAsync(_contextData.CompanyId, requestId));
    }

    /// <summary>DM sửa yêu cầu — chỉ khi còn PENDING (giữ audit đề bài sau khi duyệt).</summary>
    [HttpPut("{requestId:long}")]
    [WithRole(RoleConstants.DepartmentManager)]
    public async Task<IActionResult> Update(long requestId, [FromBody] RecruitmentRequestInputDto dto)
    {
        return Ok(await _requestService.UpdateAsync(_contextData.CompanyId, _contextData.UserId, requestId, dto));
    }

    /// <summary>DM hủy yêu cầu (soft — CANCELLED) — chỉ khi còn PENDING.</summary>
    [HttpDelete("{requestId:long}")]
    [WithRole(RoleConstants.DepartmentManager)]
    public async Task<IActionResult> Cancel(long requestId)
    {
        await _requestService.CancelAsync(_contextData.CompanyId, _contextData.UserId, requestId);
        return NoContent();
    }

    /// <summary>Recruiter duyệt: { approve, note } → APPROVED / REJECTED (từ chối bắt buộc note).</summary>
    [HttpPost("{requestId:long}/review")]
    [WithRole(RoleConstants.Recruiter)]
    public async Task<IActionResult> Review(long requestId, [FromBody] ReviewRequestDto dto)
    {
        return Ok(await _requestService.ReviewAsync(_contextData.CompanyId, _contextData.UserId, requestId, dto));
    }

    /// <summary>Recruiter gắn Job đã tạo từ yêu cầu: { jobId } → CONVERTED (truy vết đề bài → job).</summary>
    [HttpPost("{requestId:long}/convert")]
    [WithRole(RoleConstants.Recruiter)]
    public async Task<IActionResult> Convert(long requestId, [FromBody] ConvertRequestDto dto)
    {
        return Ok(await _requestService.ConvertAsync(_contextData.CompanyId, _contextData.UserId, requestId, dto));
    }
}
