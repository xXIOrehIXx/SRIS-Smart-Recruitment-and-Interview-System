using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Offer — người quyết tuyển (docs 5.15). Tại cửa INTERVIEW->OFFER, Department Manager của job
/// (job không gán DM -> Recruiter) chốt offer: đẩy state sang OFFER + tạo OfferDetail + phát link OFFER_RESPONSE.
/// </summary>
[Route("api/applications/{applicationId:long}/offer")]
[ApiController]
[Authorize]
public class OfferController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IOfferService _offerService;

    public OfferController(IContextData contextData, IOfferService offerService)
    {
        _contextData = contextData;
        _offerService = offerService;
    }

    /// <summary>Chốt offer (INTERVIEW->OFFER, qua Guard G2) + phát magic link OFFER_RESPONSE.</summary>
    [HttpPost]
    public async Task<IActionResult> Make(long applicationId, [FromBody] MakeOfferDto dto)
    {
        var result = await _offerService.MakeOfferAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, dto);
        return Ok(result);
    }

    /// <summary>Xem offer của hồ sơ (Portal).</summary>
    [HttpGet]
    public async Task<IActionResult> Get(long applicationId)
    {
        var offer = await _offerService.GetByApplicationAsync(_contextData.CompanyId, applicationId);
        return offer is null ? NotFound() : Ok(offer);
    }
}
