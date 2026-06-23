using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Đặt lịch phỏng vấn — Recruiter (docs Section 15). Tạo lịch (vòng) + mở khung cho hồ sơ đang ở
/// INTERVIEW, hệ thống phát magic link SCHEDULE để gửi ứng viên. Nhiều vòng = round_number (5.12).
/// </summary>
[Route("api/applications/{applicationId:long}/interview-schedules")]
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter)]
public class InterviewScheduleController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IInterviewSchedulingService _schedulingService;

    public InterviewScheduleController(IContextData contextData, IInterviewSchedulingService schedulingService)
    {
        _contextData = contextData;
        _schedulingService = schedulingService;
    }

    /// <summary>Tạo Interview Request (1 vòng) + mở khung + phát magic link SCHEDULE.</summary>
    [HttpPost]
    public async Task<IActionResult> Create(long applicationId, [FromBody] CreateInterviewRequestDto dto)
    {
        var result = await _schedulingService.CreateRequestAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, dto);
        return Ok(result);
    }

    /// <summary>Xem mọi lịch (vòng) của hồ sơ.</summary>
    [HttpGet]
    public async Task<IActionResult> GetByApplication(long applicationId)
    {
        var result = await _schedulingService.GetByApplicationAsync(_contextData.CompanyId, applicationId);
        return Ok(result);
    }

    /// <summary>Dời 1 lịch: mở lại bộ khung mới + phát lại magic link SCHEDULE. Chỉ cho dời 1 lần / lịch.</summary>
    [HttpPut("{scheduleId:long}/reschedule")]
    public async Task<IActionResult> Reschedule(
        long applicationId, long scheduleId, [FromBody] RescheduleRequestDto dto)
    {
        var result = await _schedulingService.RescheduleAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, scheduleId, dto);
        return Ok(result);
    }

    /// <summary>Hủy 1 lịch: set CANCELLED + khóa khung + email báo ứng viên.</summary>
    [HttpPost("{scheduleId:long}/cancel")]
    public async Task<IActionResult> Cancel(
        long applicationId, long scheduleId, [FromBody] CancelScheduleDto dto)
    {
        await _schedulingService.CancelAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, scheduleId, dto);
        return NoContent();
    }
}
