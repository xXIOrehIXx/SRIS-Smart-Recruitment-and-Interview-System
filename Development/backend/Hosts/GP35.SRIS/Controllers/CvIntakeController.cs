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
        private readonly ICvSummaryService _cvSummaryService;

        public CvIntakeController(
            IContextData contextData,
            ICvIntakeService cvIntakeService,
            ICvSummaryService cvSummaryService)
        {
            _contextData = contextData;
            _cvIntakeService = cvIntakeService;
            _cvSummaryService = cvSummaryService;
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
        /// Mở thêm cho DepartmentManager: DM phải ĐỌC ĐƯỢC CV trước khi quyết tuyển ở bước Offer.
        /// [WithRole] ở method đè [WithRole] ở controller (AuthMiddleware lấy metadata gần nhất).
        /// </para>
        /// </summary>
        [HttpGet("{cvId:long}/file-url")]
        [WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager)]
        public async Task<IActionResult> GetCvFileUrl(long cvId)
        {
            var url = await _cvIntakeService.GetCvFileUrlAsync(_contextData.CompanyId, cvId);
            if (url is null)
                return NotFound(new { error = "CV không tồn tại hoặc không có file gốc." });

            return Ok(new { url });
        }

        /// <summary>
        /// Tóm tắt CV đã lưu (không gọi AI) — mở hồ sơ phải nhanh và không phụ thuộc Ollama.
        /// Chưa tóm tắt lần nào thì trả danh sách rỗng, FE hiện nút để người dùng bấm.
        /// <para>Mở cho DepartmentManager như file-url: DM đọc hồ sơ trước khi quyết ở bước Offer.</para>
        /// </summary>
        [HttpGet("{cvId:long}/summary")]
        [WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager)]
        public async Task<IActionResult> GetSummary(long cvId)
            => Ok(await _cvSummaryService.GetAsync(_contextData.CompanyId, cvId));

        /// <summary>
        /// Sinh tóm tắt CV bằng AI rồi lưu lại. Chạy vài giây (LLM local) nên là hành động
        /// người dùng chủ động bấm, không tự chạy lúc mở trang.
        /// <para>
        /// CHỈ trích xuất nội dung CV — không chấm điểm, không so với JD, không xếp hạng.
        /// </para>
        /// </summary>
        [HttpPost("{cvId:long}/summary")]
        [WithRole(RoleConstants.HumanResource, RoleConstants.DepartmentManager)]
        public async Task<IActionResult> GenerateSummary(long cvId)
            => Ok(await _cvSummaryService.GenerateAsync(_contextData.CompanyId, cvId));
    }
}
