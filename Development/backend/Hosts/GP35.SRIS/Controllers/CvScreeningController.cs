using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Sàng lọc CV theo tin tuyển dụng bằng AI (V044): tóm tắt CV, yêu cầu đạt/thiếu, đề xuất.
///
/// <para>
/// Mở cho cả ba vai đọc hồ sơ ứng viên — bộ phận nhân sự sàng lọc, trưởng bộ phận chọn người
/// gặp, giám đốc quyết tuyển. Cùng danh sách vai với <c>GET /api/cvs/{id}/file-url</c>: ai mở
/// được CV thì đọc được bản phân tích của chính CV đó, không có lý do để lệch nhau.
/// </para>
///
/// <para>
/// Kết quả là THAM KHẢO. Không endpoint nào ở đây đổi trạng thái hồ sơ.
/// </para>
/// </summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager, RoleConstants.Director)]
public class CvScreeningController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly ICvScreeningService _screeningService;

    public CvScreeningController(IContextData contextData, ICvScreeningService screeningService)
    {
        _contextData = contextData;
        _screeningService = screeningService;
    }

    /// <summary>
    /// XẾP HÀNG một lượt AI đối chiếu CV với JD. Trả 202 ngay, KHÔNG đợi AI: Local LLM chạy CPU
    /// mất hàng chục giây nên đây là tác vụ nền. FE hỏi lại <c>GET .../cv-screening</c> cho tới
    /// khi <c>running=false</c>. Bấm lại là chạy lượt mới đè lên kết quả cũ.
    /// </summary>
    [HttpPost("api/applications/{applicationId:long}/cv-screening")]
    public async Task<IActionResult> Request(long applicationId)
    {
        var status = await _screeningService.RequestScreeningAsync(
            _contextData.CompanyId, applicationId, _contextData.UserId);
        return Accepted(status);
    }

    /// <summary>
    /// XẾP HÀNG sàng lọc cho MỌI hồ sơ đang ở vòng sàng lọc của một vị trí (V046) — điều kiện cần
    /// để màn Kanban xếp được ứng viên theo mức phù hợp. Trả 202 kèm số lượng đã xếp hàng.
    /// <para>
    /// <c>rescreen=true</c> để chấm lại cả những hồ sơ đã có kết quả (dùng khi vừa sửa tin tuyển
    /// dụng — điểm cũ đối chiếu với một JD khác thì so với nhau không còn công bằng).
    /// </para>
    /// </summary>
    [HttpPost("api/jobs/{jobId:long}/cv-screening")]
    public async Task<IActionResult> RequestForJob(long jobId, [FromQuery] bool rescreen = false)
    {
        var result = await _screeningService.RequestJobScreeningAsync(
            _contextData.CompanyId, jobId, _contextData.UserId, rescreen);
        return Accepted(result);
    }

    /// <summary>
    /// Trạng thái + kết quả lượt sàng lọc gần nhất. <c>running=true</c> -> FE hỏi lại sau vài
    /// giây; <c>DONE</c> -> đọc <c>result</c>; <c>FAILED</c> -> hiện <c>errorMessage</c>;
    /// <c>NONE</c> -> hồ sơ này chưa phân tích bao giờ.
    /// </summary>
    [HttpGet("api/applications/{applicationId:long}/cv-screening")]
    public async Task<IActionResult> GetStatus(long applicationId)
    {
        return Ok(await _screeningService.GetStatusAsync(_contextData.CompanyId, applicationId));
    }
}
