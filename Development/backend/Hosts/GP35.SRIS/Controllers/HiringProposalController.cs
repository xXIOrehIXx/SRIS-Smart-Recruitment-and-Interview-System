using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Đề xuất tuyển (docs 5.14 — V043): Trưởng bộ phận đề xuất "nên tuyển người này" kèm mức
/// lương, GIÁM ĐỐC duyệt hoặc trả lại phiếu. Duyệt = hồ sơ sang bước Quyết định (OFFER) và
/// bộ phận nhân sự soạn thư mời theo đúng mức lương trên phiếu đã duyệt (nhân sự chỉ điền
/// ngày vào làm). Giám đốc muốn mức khác thì CHƯA DUYỆT + ghi rõ, DM sửa rồi gửi lại (V053).
/// </summary>
[ApiController]
[Authorize]
public class HiringProposalController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IHiringProposalService _proposalService;

    public HiringProposalController(IContextData contextData, IHiringProposalService proposalService)
    {
        _contextData = contextData;
        _proposalService = proposalService;
    }

    /// <summary>DM đề xuất tuyển 1 ứng viên đang ở bước Phỏng vấn (kèm mức lương — bắt buộc).</summary>
    [HttpPost("api/applications/{applicationId:long}/hiring-proposal")]
    [WithRole(RoleConstants.DepartmentManager)]
    public async Task<IActionResult> Create(long applicationId, [FromBody] CreateProposalDto dto)
    {
        return Ok(await _proposalService.CreateAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, dto));
    }

    /// <summary>Lịch sử đề xuất của 1 hồ sơ (gồm cả lần bị từ chối). Ai đụng hồ sơ đều xem được.</summary>
    [HttpGet("api/applications/{applicationId:long}/hiring-proposals")]
    [WithRole(RoleConstants.DepartmentManager, RoleConstants.Director, RoleConstants.HumanResource)]
    public async Task<IActionResult> GetByApplication(long applicationId)
    {
        return Ok(await _proposalService.GetByApplicationAsync(_contextData.CompanyId, applicationId));
    }

    /// <summary>
    /// Hàng đợi đề xuất của công ty (?status=PENDING|APPROVED|REJECTED). Giám đốc dùng để quyết;
    /// DM/nhân sự xem để biết đề xuất của mình tới đâu.
    /// </summary>
    [HttpGet("api/hiring-proposals")]
    [WithRole(RoleConstants.Director, RoleConstants.DepartmentManager, RoleConstants.HumanResource)]
    public async Task<IActionResult> GetList([FromQuery] string? status = null)
    {
        return Ok(await _proposalService.GetListAsync(_contextData.CompanyId, status));
    }

    /// <summary>
    /// Giám đốc quyết: <c>{ approve, note? }</c>. Không duyệt thì <c>note</c> BẮT BUỘC — đó là
    /// thứ Trưởng bộ phận đọc để sửa phiếu (V053).
    /// Duyệt -> hồ sơ sang OFFER; không duyệt -> hồ sơ Ở LẠI bước Phỏng vấn (KHÔNG loại ứng viên).
    /// </summary>
    [HttpPost("api/hiring-proposals/{proposalId:long}/decision")]
    [WithRole(RoleConstants.Director)]
    public async Task<IActionResult> Decide(long proposalId, [FromBody] DecideProposalDto dto)
    {
        return Ok(await _proposalService.DecideAsync(
            _contextData.CompanyId, _contextData.UserId, proposalId, dto));
    }
}
