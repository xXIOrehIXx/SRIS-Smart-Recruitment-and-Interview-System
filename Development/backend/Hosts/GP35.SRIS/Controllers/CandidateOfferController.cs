using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Cổng CÔNG KHAI cho ứng viên xem/tải thư mời nhận việc qua magic link (docs 5.15) — không login.
/// Token qua "?token=" (purpose=OFFER_RESPONSE); CandidateTenantMiddleware giải tenant từ tiền tố token.
///
/// Chỉ ĐỌC: không còn endpoint phản hồi. Ứng viên trả lời nhà tuyển dụng ngoài hệ thống,
/// Human Resource/DM ghi nhận kết quả ở POST /api/applications/{id}/offer/outcome.
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

    /// <summary>Tóm tắt thư mời để hiện trên trang (vị trí, lương, ngày bắt đầu, liên hệ HR).</summary>
    [HttpGet]
    public async Task<IActionResult> GetOffer([FromQuery] string token)
    {
        return Ok(await _offerService.GetOfferAsync(token));
    }

    /// <summary>File PDF thư mời nhận việc — link trong email trỏ về đây.</summary>
    [HttpGet("letter")]
    public async Task<IActionResult> GetLetter([FromQuery] string token)
    {
        var (content, fileName) = await _offerService.GetLetterPdfAsync(token);

        // inline: ứng viên bấm link là thấy luôn thư trong trình duyệt, muốn lưu thì tự bấm tải.
        Response.Headers.ContentDisposition = $"inline; filename=\"{fileName}\"";
        return File(content, "application/pdf");
    }
}
