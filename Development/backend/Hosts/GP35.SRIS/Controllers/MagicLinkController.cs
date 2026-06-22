using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Nội bộ (Recruiter): phát magic link cho ứng viên (docs 5.13). Token GỐC chỉ trả 1 lần ở đây
/// để nhúng vào email; DB chỉ lưu hash. 4 purpose: QUIZ/SCHEDULE/STATUS/OFFER_RESPONSE.
/// </summary>
[Route("api/applications/{applicationId:long}/magic-links")]
[ApiController]
[Authorize]
public class MagicLinkController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IMagicLinkService _magicLink;

    public MagicLinkController(IContextData contextData, IMagicLinkService magicLink)
    {
        _contextData = contextData;
        _magicLink = magicLink;
    }

    /// <summary>Phát 1 magic link cho hồ sơ. TTL mặc định theo purpose (vd QUIZ 48h).</summary>
    [HttpPost]
    public async Task<IActionResult> Issue(long applicationId, [FromQuery] string purpose = "QUIZ")
    {
        var issued = await _magicLink.IssueAsync(_contextData.CompanyId, applicationId, purpose);
        return Ok(issued);
    }
}
