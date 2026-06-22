using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Collaborative Scoring (docs 5.7). Interviewer đăng nhập chấm điểm (Blind Review): nháp riêng,
/// submit mới mở blind. Recruiter/Department Manager đọc bảng tổng hợp (Radar + std dev) để quyết.
/// </summary>
[ApiController]
[Authorize]
public class InterviewScoringController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IInterviewScoringService _scoringService;

    public InterviewScoringController(IContextData contextData, IInterviewScoringService scoringService)
    {
        _contextData = contextData;
        _scoringService = scoringService;
    }

    /// <summary>Các buổi phỏng vấn được giao cho interviewer hiện tại.</summary>
    [HttpGet("api/me/interview-schedules")]
    public async Task<IActionResult> MySchedules()
    {
        return Ok(await _scoringService.GetMySchedulesAsync(_contextData.CompanyId, _contextData.UserId));
    }

    /// <summary>Phiếu chấm của interviewer cho 1 buổi (chỉ điểm của chính họ).</summary>
    [HttpGet("api/interview-schedules/{scheduleId:long}/my-sheet")]
    public async Task<IActionResult> GetSheet(long scheduleId)
    {
        return Ok(await _scoringService.GetSheetAsync(_contextData.CompanyId, _contextData.UserId, scheduleId));
    }

    /// <summary>Lưu nháp phiếu (tự lưu server).</summary>
    [HttpPut("api/interview-schedules/{scheduleId:long}/my-sheet")]
    public async Task<IActionResult> SaveDraft(long scheduleId, [FromBody] SaveScoreDraftDto dto)
    {
        return Ok(await _scoringService.SaveDraftAsync(_contextData.CompanyId, _contextData.UserId, scheduleId, dto));
    }

    /// <summary>Nộp phiếu (mở blind). Guard: phải chấm đủ mọi tiêu chí.</summary>
    [HttpPost("api/interview-schedules/{scheduleId:long}/my-sheet/submit")]
    public async Task<IActionResult> Submit(long scheduleId)
    {
        return Ok(await _scoringService.SubmitAsync(_contextData.CompanyId, _contextData.UserId, scheduleId));
    }

    /// <summary>Bảng tổng hợp panel (chỉ phiếu đã nộp): Radar + std dev + điểm từng interviewer.</summary>
    [HttpGet("api/interview-schedules/{scheduleId:long}/aggregate")]
    public async Task<IActionResult> Aggregate(long scheduleId)
    {
        return Ok(await _scoringService.GetAggregateAsync(_contextData.CompanyId, scheduleId));
    }
}
