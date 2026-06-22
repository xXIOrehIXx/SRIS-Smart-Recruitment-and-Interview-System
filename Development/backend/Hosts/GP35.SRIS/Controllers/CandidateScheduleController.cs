using GP35.SRIS.Application.Contracts.Dtos.Candidate.Schedule;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Cổng CÔNG KHAI cho ứng viên chọn/xác nhận lịch phỏng vấn qua magic link (docs 15) — không login.
/// Token qua "?token=" (purpose=SCHEDULE); CandidateTenantMiddleware giải tenant từ tiền tố token.
/// </summary>
[Route("api/candidate/schedule")]
[ApiController]
[AllowAnonymous]
public class CandidateScheduleController : ControllerBase
{
    private readonly ICandidateScheduleService _scheduleService;

    public CandidateScheduleController(ICandidateScheduleService scheduleService)
    {
        _scheduleService = scheduleService;
    }

    /// <summary>Trang chọn lịch: trạng thái + các khung còn chọn được.</summary>
    [HttpGet]
    public async Task<IActionResult> GetSchedule([FromQuery] string token)
    {
        return Ok(await _scheduleService.GetScheduleAsync(token));
    }

    /// <summary>Chốt 1 khung (khóa lạc quan).</summary>
    [HttpPost("confirm")]
    public async Task<IActionResult> Confirm([FromQuery] string token, [FromBody] ConfirmSlotDto dto)
    {
        return Ok(await _scheduleService.ConfirmAsync(token, dto));
    }

    /// <summary>"Không khung nào phù hợp".</summary>
    [HttpPost("no-slot")]
    public async Task<IActionResult> NoSlot([FromQuery] string token)
    {
        await _scheduleService.NoSlotFitsAsync(token);
        return NoContent();
    }
}
