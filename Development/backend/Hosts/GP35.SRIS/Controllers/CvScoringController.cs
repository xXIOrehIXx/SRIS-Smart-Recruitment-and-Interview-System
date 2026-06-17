using GP35.SRIS.Application.Contracts.Dtos.Ai;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Shared.Context;
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
                _contextData.CompanyId, jobId, candidateName, candidateEmail,
                file.FileName, file.ContentType, bytes);

            return Ok(result);
        }

        /// <summary>Nộp CV dạng TEXT và chấm điểm.</summary>
        [HttpPost("score-text")]
        public async Task<IActionResult> ScoreText([FromBody] CvScoreTextRequest request)
        {
            var result = await _cvScoringService.ScoreCvTextAsync(_contextData.CompanyId, request);
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
        /// Tải lại file CV gốc của 1 cv_id — chuyển hướng tới URL tải tạm thời (presigned) của MinIO.
        /// </summary>
        [HttpGet("cv/{cvId:long}/file")]
        public async Task<IActionResult> DownloadCvFile(long cvId)
        {
            var url = await _cvScoringService.GetCvFileUrlAsync(_contextData.CompanyId, cvId);
            if (url is null)
                return NotFound(new { error = "CV không tồn tại hoặc không có file gốc." });

            return Redirect(url);
        }

        /// <summary>
        /// Như trên nhưng trả URL dưới dạng JSON (để frontend tự xử lý thay vì redirect).
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
