using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Nội bộ: phát magic link cho ứng viên (docs 5.13). Token GỐC chỉ trả 1 lần ở đây
/// để nhúng vào email; DB chỉ lưu hash. 3 purpose: SCHEDULE/STATUS/OFFER_RESPONSE.
/// <para>
/// Human Resource phát được mọi purpose. DepartmentManager chỉ phát lại được OFFER_RESPONSE —
/// "gửi nhắc nhở" ở màn Offers là một phần việc quyết tuyển của họ (5.14/5.15); còn
/// SCHEDULE/STATUS thuộc khâu vận hành của Human Resource.
/// </para>
/// </summary>
[Route("api/applications/{applicationId:long}/magic-links")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager)]
public class MagicLinkController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IMagicLinkService _magicLink;

    public MagicLinkController(IContextData contextData, IMagicLinkService magicLink)
    {
        _contextData = contextData;
        _magicLink = magicLink;
    }

    /// <summary>Phát 1 magic link cho hồ sơ. TTL mặc định theo purpose (vd SCHEDULE ~5 ngày).</summary>
    [HttpPost]
    public async Task<IActionResult> Issue(long applicationId, [FromQuery] string purpose = "STATUS")
    {
        var isDepartmentManager = string.Equals(
            _contextData.Role, RoleConstants.DepartmentManager, StringComparison.OrdinalIgnoreCase);
        var isOfferResponse = string.Equals(
            purpose?.Trim(), EmailTemplateType.OfferResponse, StringComparison.OrdinalIgnoreCase);

        if (isDepartmentManager && !isOfferResponse)
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                ErrorCode = "FORBIDDEN",
                UserMsg = "Department Manager chỉ gửi lại được link phản hồi offer (OFFER_RESPONSE)."
            });

        var issued = await _magicLink.IssueAsync(_contextData.CompanyId, applicationId, purpose);
        return Ok(issued);
    }
}
