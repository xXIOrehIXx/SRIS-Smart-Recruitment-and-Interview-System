using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers
{
    /// <summary>
    /// Nhận CV vào hệ thống (Human Resource tự nộp hộ ứng viên) + tải lại file CV gốc.
    /// Không chấm điểm, không xếp hạng.
    /// </summary>
    [Route("api/cvs")]
    [ApiController]
    [Authorize]
    [WithRole(RoleConstants.HumanResource)]
    public class CvIntakeController : ControllerBase
    {
        private readonly IContextData _contextData;
        private readonly ICvIntakeService _cvIntakeService;

        public CvIntakeController(IContextData contextData, ICvIntakeService cvIntakeService)
        {
            _contextData = contextData;
            _cvIntakeService = cvIntakeService;
        }

        /// <summary>
        /// Đọc thử file PDF và trả tên/email/điện thoại bóc được, để FE ĐIỀN SẴN form nộp hộ
        /// (V047). KHÔNG lưu gì: chưa có CvDocument, chưa có hồ sơ — người dùng còn sửa rồi mới
        /// bấm nộp. Không bóc được thì trả <c>hasText=false</c> và các trường null, form để trống
        /// như trước.
        /// </summary>
        [HttpPost("parse-preview")]
        [RequestSizeLimit(20 * 1024 * 1024)] // 20MB — cùng trần với upload
        public async Task<IActionResult> ParsePreview(IFormFile file)
        {
            if (file is null || file.Length == 0)
                return BadRequest(new { error = "Thiếu file PDF (trường 'file')." });

            if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "File phải có đuôi .pdf" });

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);

            return Ok(_cvIntakeService.PreviewContact(ms.ToArray()));
        }

        /// <summary>Nộp CV dạng FILE PDF (multipart/form-data) cho một job.</summary>
        [HttpPost("upload")]
        [RequestSizeLimit(20 * 1024 * 1024)] // 20MB
        public async Task<IActionResult> Upload(
            [FromForm] long jobId,
            [FromForm] string candidateName,
            [FromForm] string candidateEmail,
            [FromForm] string? candidatePhone,
            IFormFile file)
        {
            if (file is null || file.Length == 0)
                return BadRequest(new { error = "Thiếu file PDF (trường 'file')." });

            if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { error = "File phải có đuôi .pdf" });

            byte[] bytes;
            using (var ms = new MemoryStream())
            {
                await file.CopyToAsync(ms);
                bytes = ms.ToArray();
            }

            var result = await _cvIntakeService.UploadCvAsync(
                _contextData.CompanyId, jobId, candidateName, candidateEmail, candidatePhone,
                file.FileName, file.ContentType, bytes);

            return Ok(result);
        }

        /// <summary>
        /// Trả URL tạm thời (presigned, ~1h) để xem/tải file CV gốc. URL mở inline trong
        /// trình duyệt (xem PDF); khi lưu sẽ có tên đẹp dạng CV_&lt;tên ứng viên&gt;.pdf.
        /// <para>
        /// Mở cho MỌI vai tham gia xét hồ sơ. DM phải đọc CV trước khi chọn người vào phỏng vấn,
        /// Giám đốc trước khi quyết tuyển, và <b>Interviewer trước khi ngồi vào phòng phỏng vấn</b> —
        /// vai này bị bỏ sót tới 17/08/2026, tức là người phỏng vấn không mở nổi CV của chính ứng
        /// viên họ sắp gặp, phải hỏi xin qua chat. Không có lý do gì để họ chấm mà chưa đọc hồ sơ.
        /// [WithRole] ở method đè [WithRole] ở controller (AuthMiddleware lấy metadata gần nhất).
        /// </para>
        /// </summary>
        [HttpGet("{cvId:long}/file-url")]
        [WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager, RoleConstants.Director,
            RoleConstants.Interviewer)]
        public async Task<IActionResult> GetCvFileUrl(long cvId)
        {
            var url = await _cvIntakeService.GetCvFileUrlAsync(_contextData.CompanyId, cvId);
            if (url is null)
                return NotFound(new { error = "CV không tồn tại hoặc không có file gốc." });

            return Ok(new { url });
        }
    }
}
