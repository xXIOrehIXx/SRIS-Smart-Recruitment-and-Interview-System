using GP35.SRIS.Application.Contracts.Dtos.Business.Request;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Yêu cầu tuyển dụng (docs 5.17 — TÙY CHỌN): DM "ra đề" → GIÁM ĐỐC duyệt → Human Resource tạo Job
/// từ yêu cầu đã duyệt.
///
/// <para>
/// V047 (18/08/2026 — sau phản hồi hội đồng): người duyệt đổi từ Human Resource sang GIÁM ĐỐC.
/// Mở một vị trí là cam kết chi tiền của công ty, nên nó thuộc người chịu trách nhiệm — cùng
/// một lý do đã đưa quyết định tuyển về tay Giám đốc ở V043. Để nhân sự gác cửa này là tái lập
/// đúng điều hội đồng phê ("nhân sự không được quyền phê duyệt"), chỉ khác là ở ĐẦU quy trình.
/// </para>
///
/// DM tạo/sửa/hủy (khi PENDING); Giám đốc duyệt; Human Resource xem + gắn job.
/// Admin bypass toàn bộ (công ty nhỏ dùng 1 tài khoản).
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

    /// <summary>Danh sách yêu cầu của công ty (?status=PENDING/... để lọc). DM + Giám đốc + Human Resource cùng xem.</summary>
    [HttpGet]
    [WithRole(RoleConstants.DepartmentManager, RoleConstants.Director, RoleConstants.HumanResource)]
    public async Task<IActionResult> GetList([FromQuery] string? status = null)
    {
        return Ok(await _requestService.GetListAsync(_contextData.CompanyId, status));
    }

    /// <summary>Chi tiết 1 yêu cầu.</summary>
    [HttpGet("{requestId:long}")]
    [WithRole(RoleConstants.DepartmentManager, RoleConstants.Director, RoleConstants.HumanResource)]
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

    /// <summary>Giám đốc duyệt: { approve, note } → APPROVED / REJECTED (note tùy chọn).</summary>
    [HttpPost("{requestId:long}/review")]
    [WithRole(RoleConstants.Director)]
    public async Task<IActionResult> Review(long requestId, [FromBody] ReviewRequestDto dto)
    {
        return Ok(await _requestService.ReviewAsync(_contextData.CompanyId, _contextData.UserId, requestId, dto));
    }

    /// <summary>
    /// Human Resource gắn Job đã tạo từ yêu cầu: { jobId } → CONVERTED (truy vết đề bài → job).
    /// Chỉ gắn được cho yêu cầu ĐÃ ĐƯỢC GIÁM ĐỐC DUYỆT (xem <c>ConvertAsync</c>).
    /// </summary>
    [HttpPost("{requestId:long}/convert")]
    [WithRole(RoleConstants.HumanResource)]
    public async Task<IActionResult> Convert(long requestId, [FromBody] ConvertRequestDto dto)
    {
        return Ok(await _requestService.ConvertAsync(_contextData.CompanyId, _contextData.UserId, requestId, dto));
    }
}
