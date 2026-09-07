using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Tiêu chí đánh giá per-job (docs 5.7, 5.18) — bộ khung để interviewer chấm phỏng vấn.
/// CRUD + AI bóc DRAFT từ JD + người duyệt chốt APPROVED.
///
/// <para><b>Trưởng bộ phận vào được (24/08/2026):</b> họ là người RA ĐỀ cho vị trí của bộ phận
/// mình, nên bóc tiêu chí bằng AI và chốt bộ tiêu chí là việc của họ. Nhân sự giữ nguyên quyền cũ
/// (công ty nhỏ hay nhờ nhân sự nhập hộ). Ràng buộc "đúng vị trí mình phụ trách" của DM nằm ở
/// tầng service — <c>JobCriteriaAccessGuard</c>, không phải ở đây, vì attribute này chỉ biết role.</para>
///
/// <para><b>V055 (07/09/2026) — SOẠN và DUYỆT là hai cửa khác nhau:</b>
/// <c>extract</c> / CRUD / <c>submit</c> là cửa SOẠN (nhân sự + DM của vị trí + Admin);
/// <c>approve</c> / <c>request-changes</c> là cửa DUYỆT và chỉ Trưởng bộ phận của vị trí đó đi
/// qua được. Vòng đời: DRAFT -> (gửi) PENDING -> APPROVED, hoặc PENDING -> DRAFT kèm lý do.</para>
/// </summary>
[ApiController]
[Authorize]
[WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager)]
public class EvaluationCriteriaController : ControllerBase
{
    private readonly IContextData _contextData;
    private readonly IEvaluationCriteriaService _criteriaService;

    public EvaluationCriteriaController(
        IContextData contextData,
        IEvaluationCriteriaService criteriaService)
    {
        _contextData = contextData;
        _criteriaService = criteriaService;
    }

    // ===================== V056: bộ tiêu chí trên YÊU CẦU TUYỂN DỤNG =====================
    // Trưởng bộ phận ra đề NGAY LÚC mô tả vị trí, trước khi job tồn tại. Ràng buộc "đúng yêu cầu
    // của mình" nằm ở tầng service (JobCriteriaAccessGuard.EnsureCanEditRequestCriteriaAsync) —
    // [WithRole] ở đầu controller chỉ biết role, không biết yêu cầu này của ai.
    // ĐỌC để mở: Giám đốc cần nhìn bộ tiêu chí khi duyệt yêu cầu, nhân sự cần nhìn trước khi
    // tạo tin — nên GET không gác gì thêm.

    /// <summary>Tiêu chí của một yêu cầu tuyển dụng (gồm cả DRAFT — FE phân biệt qua status).</summary>
    [HttpGet("api/recruitment-requests/{requestId:long}/criteria")]
    [WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager, RoleConstants.Director)]
    public async Task<IActionResult> GetByRequest(long requestId, [FromQuery] bool includeInactive = false)
    {
        return Ok(await _criteriaService.GetByRequestAsync(_contextData.CompanyId, requestId, includeInactive));
    }

    /// <summary>Thêm 1 tiêu chí gõ tay cho yêu cầu tuyển dụng (-> APPROVED luôn).</summary>
    [HttpPost("api/recruitment-requests/{requestId:long}/criteria")]
    public async Task<IActionResult> CreateForRequest(long requestId, [FromBody] CriteriaInputDto dto)
    {
        return Ok(await _criteriaService.CreateForRequestAsync(_contextData.CompanyId, requestId, dto));
    }

    /// <summary>
    /// XẾP HÀNG lượt AI bóc tiêu chí từ chính nội dung yêu cầu tuyển dụng. Trả 202 ngay —
    /// cùng khuôn chạy nền với đường bóc từ tin tuyển dụng (V037).
    /// </summary>
    [HttpPost("api/recruitment-requests/{requestId:long}/criteria/extract")]
    public async Task<IActionResult> ExtractForRequest(long requestId)
    {
        var status = await _criteriaService.RequestExtractForRequestAsync(
            _contextData.CompanyId, requestId, _contextData.UserId);
        return Accepted(status);
    }

    /// <summary>Trạng thái lượt bóc gần nhất của yêu cầu — FE hỏi lại tới khi <c>running=false</c>.</summary>
    [HttpGet("api/recruitment-requests/{requestId:long}/criteria/extract-status")]
    [WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager, RoleConstants.Director)]
    public async Task<IActionResult> ExtractStatusForRequest(long requestId)
    {
        return Ok(await _criteriaService.GetExtractStatusForRequestAsync(_contextData.CompanyId, requestId));
    }

    /// <summary>
    /// Trưởng bộ phận chốt bộ tiêu chí ngay trên yêu cầu: DRAFT -> APPROVED, MỘT nút.
    /// Không có bước "gửi duyệt" như bên job (V055) vì ở đây người ra đề chính là người duyệt.
    /// </summary>
    [HttpPost("api/recruitment-requests/{requestId:long}/criteria/approve")]
    public async Task<IActionResult> ApproveForRequest(long requestId)
    {
        var approved = await _criteriaService.ApproveForRequestAsync(
            _contextData.CompanyId, requestId, _contextData.UserId);
        return Ok(new { approved });
    }

    // ===================== hết khối V056 =====================

    /// <summary>Thêm 1 tiêu chí cho job (người gõ trực tiếp -> APPROVED luôn).</summary>
    [HttpPost("api/jobs/{jobId:long}/criteria")]
    public async Task<IActionResult> Create(long jobId, [FromBody] CriteriaInputDto dto)
    {
        return Ok(await _criteriaService.CreateAsync(_contextData.CompanyId, jobId, dto));
    }

    /// <summary>Tiêu chí của job (gồm cả DRAFT chờ duyệt — FE phân biệt qua status).</summary>
    [HttpGet("api/jobs/{jobId:long}/criteria")]
    public async Task<IActionResult> GetByJob(long jobId, [FromQuery] bool includeInactive = false)
    {
        return Ok(await _criteriaService.GetByJobAsync(_contextData.CompanyId, jobId, includeInactive));
    }

    /// <summary>Sửa 1 tiêu chí (gồm bật/tắt, phân loại HARD/SOFT, keywords).</summary>
    [HttpPut("api/evaluation-criteria/{criteriaId:long}")]
    public async Task<IActionResult> Update(long criteriaId, [FromBody] CriteriaUpdateDto dto)
    {
        return Ok(await _criteriaService.UpdateAsync(_contextData.CompanyId, criteriaId, dto));
    }

    /// <summary>Gỡ 1 tiêu chí khỏi job (soft — active=0).</summary>
    [HttpDelete("api/evaluation-criteria/{criteriaId:long}")]
    public async Task<IActionResult> Delete(long criteriaId)
    {
        await _criteriaService.DeactivateAsync(_contextData.CompanyId, criteriaId);
        return NoContent();
    }

    /// <summary>
    /// XẾP HÀNG một lượt AI bóc tiêu chí từ JD (Local LLM — 5.18). Trả 202 ngay, KHÔNG đợi AI:
    /// Local LLM chạy CPU mất hàng chục giây nên đây là tác vụ nền (V037). FE hỏi lại
    /// <c>GET .../criteria/extract-status</c> cho tới khi <c>running=false</c>.
    /// </summary>
    [HttpPost("api/jobs/{jobId:long}/criteria/extract")]
    public async Task<IActionResult> Extract(long jobId)
    {
        var status = await _criteriaService.RequestExtractAsync(
            _contextData.CompanyId, jobId, _contextData.UserId);
        return Accepted(status);
    }

    /// <summary>
    /// Trạng thái lượt bóc gần nhất của job. <c>running=true</c> -> FE hỏi lại sau vài giây;
    /// <c>DONE</c> -> nạp lại danh sách tiêu chí; <c>FAILED</c> -> hiện <c>errorMessage</c>.
    /// </summary>
    [HttpGet("api/jobs/{jobId:long}/criteria/extract-status")]
    public async Task<IActionResult> ExtractStatus(long jobId)
    {
        return Ok(await _criteriaService.GetExtractStatusAsync(_contextData.CompanyId, jobId));
    }

    /// <summary>
    /// Người soạn gửi bộ tiêu chí cho Trưởng bộ phận duyệt: mọi DRAFT của job -> PENDING (V055).
    /// Sau bước này bộ tiêu chí KHOÁ SỬA cho tới khi Trưởng bộ phận trả lời.
    /// </summary>
    [HttpPost("api/jobs/{jobId:long}/criteria/submit")]
    public async Task<IActionResult> Submit(long jobId)
    {
        var submitted = await _criteriaService.SubmitForReviewAsync(
            _contextData.CompanyId, jobId, _contextData.UserId);
        return Ok(new { submitted });
    }

    /// <summary>
    /// Trưởng bộ phận CHỐT bộ tiêu chí: mọi PENDING của job -> APPROVED (ghi audit ai duyệt).
    /// Từ đây bộ tiêu chí là phiếu chấm phỏng vấn. Nhân sự gọi vào đây sẽ nhận 403.
    /// </summary>
    [HttpPost("api/jobs/{jobId:long}/criteria/approve")]
    public async Task<IActionResult> Approve(long jobId)
    {
        var approved = await _criteriaService.ApproveDraftsAsync(
            _contextData.CompanyId, jobId, _contextData.UserId);
        return Ok(new { approved });
    }

    /// <summary>
    /// Trưởng bộ phận trả bộ tiêu chí về cho người soạn sửa: PENDING -> DRAFT kèm lý do (V055).
    /// <c>note</c> BẮT BUỘC. Đây KHÔNG phải "loại bộ tiêu chí" — nó quay lại nháp và gửi lại được.
    /// </summary>
    [HttpPost("api/jobs/{jobId:long}/criteria/request-changes")]
    public async Task<IActionResult> RequestChanges(long jobId, [FromBody] CriteriaRequestChangesDto dto)
    {
        var returned = await _criteriaService.RequestChangesAsync(
            _contextData.CompanyId, jobId, _contextData.UserId, dto?.Note);
        return Ok(new { returned });
    }
}
