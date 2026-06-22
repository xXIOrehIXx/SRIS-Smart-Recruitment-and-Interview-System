using GP35.SRIS.Application.Contracts.Dtos.Ai;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers
{
    /// <summary>
    /// Chấm điểm CV bằng AI (PDF -> text -> vector -> VECTOR_DISTANCE -> điểm 0-100).
    /// </summary>
    [Route("api/cv-scoring")]
    [ApiController]
    [Authorize]
    [WithRole(RoleConstants.Recruiter)]
    public class CvScoringController : ControllerBase
    {
        private readonly IContextData _contextData;
        private readonly ICvScoringService _cvScoringService;

        public CvScoringController(IContextData contextData, ICvScoringService cvScoringService)
        {
            _contextData = contextData;
            _cvScoringService = cvScoringService;
        }

        /// <summary>Nộp CV dạng FILE PDF (multipart/form-data) và chấm điểm.</summary>
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

            var result = await _cvScoringService.ScoreUploadedCvAsync(
                _contextData.CompanyId, jobId, candidateName, candidateEmail, candidatePhone,
                file.FileName, file.ContentType, bytes);

            return Ok(result);
        }

        /// <summary>Bảng xếp hạng ứng viên của 1 job theo điểm AI giảm dần.</summary>
        [HttpGet("jobs/{jobId:long}/ranking")]
        public async Task<IActionResult> Ranking(long jobId)
        {
            var ranking = await _cvScoringService.GetRankingAsync(_contextData.CompanyId, jobId);
            return Ok(ranking);
        }

        /// <summary>
        /// Trả URL tạm thời (presigned, ~1h) để xem/tải file CV gốc. URL mở inline trong
        /// trình duyệt (xem PDF); khi lưu sẽ có tên đẹp dạng CV_&lt;tên ứng viên&gt;.pdf.
        /// </summary>
        [HttpGet("cv/{cvId:long}/file-url")]
        public async Task<IActionResult> GetCvFileUrl(long cvId)
        {
            var url = await _cvScoringService.GetCvFileUrlAsync(_contextData.CompanyId, cvId);
            if (url is null)
                return NotFound(new { error = "CV không tồn tại hoặc không có file gốc." });

            return Ok(new { url });
        }
    }
}
