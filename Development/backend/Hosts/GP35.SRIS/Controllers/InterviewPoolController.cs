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
/// Đặt lịch phỏng vấn theo POOL dùng chung — Recruiter (docs Section 15). Mở 1 bộ khung cho job +
/// vòng, mời nhiều ứng viên (mỗi người 1 magic link SCHEDULE), ai chốt trước lấy trước. Chốt lịch
/// tay cho nhánh gọi điện. Nhiều vòng = round_number (5.12), KÉO trước (card ở INTERVIEW), MỜI sau.
/// </summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.Recruiter)]
public class InterviewPoolController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IInterviewPoolService _poolService;
    private readonly IUserRepo _userRepo;

    public InterviewPoolController(IContextData contextData, IInterviewPoolService poolService, IUserRepo userRepo)
    {
        _contextData = contextData;
        _poolService = poolService;
        _userRepo = userRepo;
    }

    /// <summary>Mở 1 pool khung dùng chung cho 1 job + vòng.</summary>
    [HttpPost("api/jobs/{jobId:long}/interview-pools")]
    public async Task<IActionResult> CreatePool(long jobId, [FromBody] CreatePoolDto dto)
    {
        var result = await _poolService.CreatePoolAsync(_contextData.CompanyId, _contextData.UserId, jobId, dto);
        return Ok(result);
    }

    /// <summary>Xem mọi pool của 1 job kèm khung + ứng viên đã mời (có cờ nhắc gọi điện).</summary>
    [HttpGet("api/jobs/{jobId:long}/interview-pools")]
    public async Task<IActionResult> GetByJob(long jobId)
    {
        var result = await _poolService.GetPoolsByJobAsync(_contextData.CompanyId, jobId);
        return Ok(result);
    }

    /// <summary>Mời 1 danh sách ứng viên vào pool — mỗi người 1 magic link SCHEDULE (tự gửi email).</summary>
    [HttpPost("api/interview-pools/{poolId:long}/invitations")]
    public async Task<IActionResult> Invite(long poolId, [FromBody] InvitePoolDto dto)
    {
        var result = await _poolService.InviteAsync(_contextData.CompanyId, _contextData.UserId, poolId, dto);
        return Ok(result);
    }

    /// <summary>Hủy pool: khóa khung + hủy invite chờ + email báo ứng viên đã chốt.</summary>
    [HttpPost("api/interview-pools/{poolId:long}/cancel")]
    public async Task<IActionResult> Cancel(long poolId, [FromBody] CancelPoolDto dto)
    {
        await _poolService.CancelPoolAsync(_contextData.CompanyId, _contextData.UserId, poolId, dto);
        return NoContent();
    }

    /// <summary>Chốt lịch TAY cho 1 ứng viên (nhánh gọi điện — không qua pool/magic link).</summary>
    [HttpPost("api/applications/{applicationId:long}/manual-interview")]
    public async Task<IActionResult> ManualConfirm(long applicationId, [FromBody] ManualConfirmDto dto)
    {
        var scheduleId = await _poolService.ManualConfirmAsync(
            _contextData.CompanyId, _contextData.UserId, applicationId, dto);
        return Ok(new { scheduleId });
    }

    /// <summary>
    /// Danh sách Interviewer (user có role chứa "Interviewer", đang Active) trong công ty hiện tại —
    /// phục vụ dropdown chọn người phỏng vấn khi Recruiter tạo pool. Tách khỏi /api/users (Admin-only)
    /// để Recruiter có thể dùng mà không cần quyền Admin.
    /// </summary>
    [HttpGet("api/interview-pools/interviewers")]
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
