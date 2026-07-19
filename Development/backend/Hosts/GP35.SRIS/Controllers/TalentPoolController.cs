using GP35.SRIS.Application.Contracts.Dtos.Ai;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Talent Pool / CV Suggestion (Việc 13) — Recruiter bấm "Gợi ý CV" cho 1 job: đảo chiều vector search
/// trên kho CvDocument cũ của công ty -> Top N ứng viên gần JD, lọc theo độ tươi. Cô lập tenant tuyệt đối.
/// </summary>
[Route("api/jobs/{jobId:long}/talent-pool")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter)]
public class TalentPoolController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly ITalentPoolService _talentPoolService;

    public TalentPoolController(IContextData contextData, ITalentPoolService talentPoolService)
    {
        _contextData = contextData;
        _talentPoolService = talentPoolService;
    }

    /// <summary>Gợi ý CV từ kho cũ. withinMonths = độ tươi (mặc định 6 tháng); topN = số gợi ý (mặc định 10).</summary>
    /// <summary>
    /// Gửi email mời 1 ứng viên trong kho vào job này (kèm link career site).
    /// Trả { sent } — false khi SMTP chưa cấu hình để FE hiện link gửi tay.
    /// </summary>
    [HttpPost("invite")]
    public async Task<IActionResult> Invite(long jobId, [FromBody] TalentPoolInviteDto dto)
    {
        var sent = await _talentPoolService.InviteAsync(
            _contextData.CompanyId, jobId, dto.CandidateEmail, dto.CandidateName ?? "bạn");
        return Ok(new { sent });
    }

    [HttpGet]
    public async Task<IActionResult> Suggest(
        long jobId, [FromQuery] int withinMonths = 6, [FromQuery] int topN = 10)
    {
        var result = await _talentPoolService.SuggestForJobAsync(
            _contextData.CompanyId, jobId, withinMonths, topN);
        return Ok(result);
    }
}
