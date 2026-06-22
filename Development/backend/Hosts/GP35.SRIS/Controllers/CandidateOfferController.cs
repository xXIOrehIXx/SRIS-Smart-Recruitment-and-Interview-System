using GP35.SRIS.Application.Contracts.Dtos.Candidate.Offer;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Cổng CÔNG KHAI cho ứng viên tự nhận/từ chối offer qua magic link (docs 5.15) — không login.
/// Token qua "?token=" (purpose=OFFER_RESPONSE); CandidateTenantMiddleware giải tenant từ tiền tố token.
/// </summary>
[Route("api/candidate/offer")]
[ApiController]
[AllowAnonymous]
public class CandidateOfferController : ControllerBase
{
    private readonly ICandidateOfferService _offerService;

    public CandidateOfferController(ICandidateOfferService offerService)
    {
        _offerService = offerService;
    }

    /// <summary>Trang xem offer: lương/ngày vào làm/hạn phản hồi.</summary>
    [HttpGet]
    public async Task<IActionResult> GetOffer([FromQuery] string token)
    {
        return Ok(await _offerService.GetOfferAsync(token));
    }

    /// <summary>Phản hồi offer (Đồng ý/Từ chối) -> HIRED/REJECTED.</summary>
    [HttpPost("respond")]
    public async Task<IActionResult> Respond([FromQuery] string token, [FromBody] OfferResponseDto dto)
    {
        return Ok(await _offerService.RespondAsync(token, dto));
    }
}
