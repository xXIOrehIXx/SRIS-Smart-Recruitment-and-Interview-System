using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// AI tổng hợp ý kiến hội đồng phỏng vấn của một hồ sơ (V047 — phản hồi hội đồng 18/08/2026:
/// "màn hình tổng hợp ý kiến interviewer cần AI").
///
/// <para>
/// Dành cho người ĐỌC để quyết: Trưởng bộ phận (đề xuất tuyển) và Giám đốc (quyết tuyển);
/// nhân sự xem được vì họ theo dõi tiến độ hồ sơ. Người phỏng vấn KHÔNG vào đây: bản tổng hợp
/// gộp ý kiến của cả panel, cho họ đọc là phá blind review ở vòng sau.
/// </para>
///
/// <para>
/// Bản tổng hợp KHÔNG kết luận nên tuyển hay không, và không endpoint nào ở đây đổi trạng thái
/// hồ sơ. Cùng ranh giới đã giữ ở sàng lọc CV (V044).
/// </para>
/// </summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.DepartmentManager, RoleConstants.Director, RoleConstants.HumanResource)]
public class PanelSummaryController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IPanelSummaryService _summaryService;

    public PanelSummaryController(IContextData contextData, IPanelSummaryService summaryService)
    {
        _contextData = contextData;
        _summaryService = summaryService;
    }

    /// <summary>
    /// XẾP HÀNG một lượt tổng hợp. Trả 202 ngay, KHÔNG đợi AI (Local LLM chạy CPU). FE hỏi lại
    /// <c>GET .../panel-summary</c> cho tới khi <c>running=false</c>. Bấm lại = chạy lượt mới
    /// đè lên bản cũ — đúng thứ cần khi có thêm người nộp phiếu.
    /// </summary>
    [HttpPost("api/applications/{applicationId:long}/panel-summary")]
    public async Task<IActionResult> Request(long applicationId)
    {
        var status = await _summaryService.RequestSummaryAsync(
            _contextData.CompanyId, applicationId, _contextData.UserId);
        return Accepted(status);
    }

    /// <summary>
    /// Trạng thái + kết quả bản tổng hợp gần nhất. <c>status=NONE</c> nghĩa là chưa ai bấm
    /// tổng hợp cho hồ sơ này (không phải lỗi).
    /// </summary>
    [HttpGet("api/applications/{applicationId:long}/panel-summary")]
    public async Task<IActionResult> Get(long applicationId)
    {
        return Ok(await _summaryService.GetStatusAsync(_contextData.CompanyId, applicationId));
    }
}
