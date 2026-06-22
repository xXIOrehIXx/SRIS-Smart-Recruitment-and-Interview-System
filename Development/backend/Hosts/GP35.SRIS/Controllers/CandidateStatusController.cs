using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Cổng CÔNG KHAI cho ứng viên tự xem trạng thái hồ sơ qua magic link (docs 5.13) — không login.
/// Token qua "?token=" (purpose=STATUS); CandidateTenantMiddleware giải tenant từ tiền tố token.
/// Chỉ đọc — không lộ dữ liệu nội bộ, token không bị đốt.
/// </summary>
[Route("api/candidate/status")]
[ApiController]
[AllowAnonymous]
public class CandidateStatusController : ControllerBase
{
    private readonly ICandidateStatusService _statusService;

    public CandidateStatusController(ICandidateStatusService statusService)
    {
        _statusService = statusService;
    }

    /// <summary>Trạng thái hồ sơ (bước hiện tại + thông điệp thân thiện).</summary>
    [HttpGet]
    public async Task<IActionResult> GetStatus([FromQuery] string token)
    {
        return Ok(await _statusService.GetStatusAsync(token));
    }
}
