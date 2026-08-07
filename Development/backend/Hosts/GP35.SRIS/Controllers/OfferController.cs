using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Thư mời nhận việc (docs 5.15). Người quyết (DM của job; job không gán DM -> Human Resource) đã đẩy
/// hồ sơ sang OFFER; Human Resource gọi API này để soạn + gửi thư mời (PDF qua email), rồi ghi nhận
/// kết quả ứng viên trả lời ngoài hệ thống.
/// </summary>
[Route("api/applications/{applicationId:long}/offer")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.HumanResource)]
public class OfferController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IOfferService _offerService;

    public OfferController(IContextData contextData, IOfferService offerService)
    {
        _contextData = contextData;
        _offerService = offerService;
    }

    /// <summary>Giá trị gợi ý để mở sẵn form soạn thư (lấy từ Job + Company + hồ sơ).</summary>
    [HttpGet("defaults")]
    public async Task<IActionResult> GetDefaults(long applicationId)
    {
        return Ok(await _offerService.GetLetterDefaultsAsync(_contextData.CompanyId, applicationId));
    }

    /// <summary>Soạn + gửi thư mời nhận việc; trả kèm link để ứng viên mở file PDF.</summary>
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

    /// <summary>Xem lại chính file PDF thư mời đã gửi cho ứng viên.</summary>
    [HttpGet("letter")]
    public async Task<IActionResult> GetLetter(long applicationId)
    {
        var letter = await _offerService.GetLetterPdfAsync(_contextData.CompanyId, applicationId);
        if (letter is null) return NotFound();

        // inline: mở thẳng trong tab trình duyệt, không ép tải về.
        Response.Headers.ContentDisposition = $"inline; filename=\"{letter.Value.FileName}\"";
        return File(letter.Value.Content, "application/pdf");
    }

    /// <summary>
    /// Ghi nhận kết quả ứng viên trả lời ngoài hệ thống: nhận việc -> HIRED, từ chối -> REJECTED.
    /// </summary>
    [HttpPost("outcome")]
    public async Task<IActionResult> RecordOutcome(long applicationId, [FromBody] OfferOutcomeDto dto)
    {
        var result = await _offerService.RecordOutcomeAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, dto);
        return Ok(result);
    }
}
