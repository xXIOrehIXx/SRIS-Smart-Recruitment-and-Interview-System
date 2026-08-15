using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Đặt lịch phỏng vấn — bộ phận nhân sự (docs Section 15, viết lại 15/08/2026).
///
/// Nhân sự gọi cho người phỏng vấn hỏi lịch rảnh, gọi ứng viên chốt giờ, rồi nhập buổi vào đây.
/// Mô hình pool khung + magic link SCHEDULE (ứng viên tự chọn khung) đã bỏ hẳn.
/// Chỉ đặt được cho hồ sơ đã được Trưởng bộ phận duyệt vào vòng phỏng vấn.
/// </summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.HumanResource)]
public class InterviewScheduleController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IInterviewScheduleService _scheduleService;
    private readonly IUserRepo _userRepo;

    public InterviewScheduleController(
        IContextData contextData, IInterviewScheduleService scheduleService, IUserRepo userRepo)
    {
        _contextData = contextData;
        _scheduleService = scheduleService;
        _userRepo = userRepo;
    }

    /// <summary>Đặt 1 buổi phỏng vấn đã thống nhất qua điện thoại → trả <c>{ scheduleId }</c>.</summary>
    [HttpPost("api/applications/{applicationId:long}/interviews")]
    public async Task<IActionResult> Book(long applicationId, [FromBody] BookInterviewDto dto)
    {
        var scheduleId = await _scheduleService.BookAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, dto);
        return Ok(new { scheduleId });
    }

    /// <summary>
    /// Mọi buổi phỏng vấn của 1 vị trí. Trưởng bộ phận/Giám đốc xem được (chỉ đọc — theo dõi
    /// lịch của vị trí mình phụ trách / của công ty).
    /// </summary>
    [HttpGet("api/jobs/{jobId:long}/interviews")]
    [WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager, RoleConstants.Director)]
    public async Task<IActionResult> GetByJob(long jobId)
    {
        return Ok(await _scheduleService.GetByJobAsync(_contextData.CompanyId, jobId));
    }

    /// <summary>Hủy 1 buổi phỏng vấn — body <c>{ reason? }</c>; hệ thống email báo ứng viên.</summary>
    [HttpPost("api/interview-schedules/{scheduleId:long}/cancel")]
    public async Task<IActionResult> Cancel(long scheduleId, [FromBody] CancelInterviewDto dto)
    {
        await _scheduleService.CancelAsync(_contextData.CompanyId, _contextData.UserId, scheduleId, dto);
        return NoContent();
    }

    /// <summary>
    /// Danh sách Interviewer (user role "Interviewer", đang Active) — dropdown chọn người phỏng vấn.
    /// Tách khỏi /api/users (Admin-only) để nhân sự dùng được mà không cần quyền Admin.
    /// </summary>
    [HttpGet("api/interviews/interviewers")]
    public async Task<IActionResult> ListInterviewers()
    {
        var users = await _userRepo.GetListByRoleAsync(_contextData.CompanyId, RoleConstants.Interviewer);
        var result = users.Select(u => new
        {
            userId = u.UserId,
            email = u.Email,
            fullName = u.FullName,
            phone = u.Phone,
            role = u.Role
        });
        return Ok(result);
    }
}
