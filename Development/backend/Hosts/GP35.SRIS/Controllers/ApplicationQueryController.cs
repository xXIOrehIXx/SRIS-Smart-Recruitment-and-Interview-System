using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>Đọc hồ sơ ứng tuyển cho Kanban + màn chi tiết ứng viên (5.16). Human Resource/DM.</summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.HumanResource, RoleConstants.Interviewer, RoleConstants.DepartmentManager,
    RoleConstants.Director)]
public class ApplicationQueryController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IApplicationQueryService _queryService;

    public ApplicationQueryController(IContextData contextData, IApplicationQueryService queryService)
    {
        _contextData = contextData;
        _queryService = queryService;
    }

    /// <summary>
    /// Toàn bộ hồ sơ của 1 job cho Kanban (FE nhóm theo state thành 4 pha), kèm kết quả sàng lọc
    /// CV của từng hồ sơ.
    /// <para>
    /// <c>sort=fit</c> đưa hồ sơ AI thấy phù hợp nhất lên đầu (hồ sơ chưa phân tích xuống cuối);
    /// mặc định <c>sort=recent</c> giữ nguyên thứ tự mới nộp trước. Giá trị lạ -> coi như recent,
    /// không ném lỗi: đây là tuỳ chọn hiển thị, không đáng làm hỏng cả màn hình.
    /// </para>
    /// </summary>
    [HttpGet("api/jobs/{jobId:long}/applications")]
    public async Task<IActionResult> GetByJob(long jobId, [FromQuery] string? sort = null)
    {
        var order = string.Equals(sort, "fit", StringComparison.OrdinalIgnoreCase)
            ? BoardSort.Fit
            : BoardSort.Recent;

        return Ok(await _queryService.GetBoardByJobAsync(_contextData.CompanyId, jobId, order));
    }

    /// <summary>Chi tiết 1 hồ sơ ứng viên.</summary>
    [HttpGet("api/applications/{applicationId:long}")]
    public async Task<IActionResult> GetById(long applicationId)
    {
        return Ok(await _queryService.GetDetailAsync(_contextData.CompanyId, applicationId));
    }

    /// <summary>
    /// Tải danh sách ứng viên của 1 vị trí dạng Excel (V047) — liên hệ + trạng thái + kết quả
    /// AI đọc CV (tóm tắt, yêu cầu đạt kèm trích dẫn, yêu cầu thiếu, điểm phù hợp).
    /// Người phỏng vấn KHÔNG tải được: họ chỉ chấm ứng viên được giao, không cầm cả danh sách.
    /// </summary>
    [HttpGet("api/jobs/{jobId:long}/applications/export")]
    [WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager, RoleConstants.Director)]
    public async Task<IActionResult> ExportByJob(long jobId)
    {
        var (content, fileName) = await _queryService.ExportByJobAsync(_contextData.CompanyId, jobId);
        return File(content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }
}
