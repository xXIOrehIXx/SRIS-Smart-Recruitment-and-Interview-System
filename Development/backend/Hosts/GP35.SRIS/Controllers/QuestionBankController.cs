using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers
{
    /// <summary>
    /// Ngân hàng câu hỏi đã duyệt (5.6 / Việc 12). Bank tự bồi khi Recruiter duyệt quiz; ở đây chỉ
    /// XEM/QUẢN LÝ. Kéo câu từ bank vào quiz nằm ở POST /api/quizzes/{quizId}/questions/from-bank.
    /// </summary>
    [Route("api/question-bank")]
    [ApiController]
    [Authorize]
    [WithRole(RoleConstants.Recruiter)]
    public class QuestionBankController : ControllerBase
    {
        private readonly IContextData _contextData;
        private readonly IQuestionBankService _bankService;

        public QuestionBankController(IContextData contextData, IQuestionBankService bankService)
        {
            _contextData = contextData;
            _bankService = bankService;
        }

        /// <summary>Tìm câu trong bank theo chủ đề/từ khoá (phân trang).</summary>
        [HttpGet]
        public async Task<IActionResult> Search(
            [FromQuery] string? topic, [FromQuery] string? search,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var result = await _bankService.SearchAsync(_contextData.CompanyId, topic, search, page, pageSize);
            return Ok(result);
        }

        /// <summary>Ẩn 1 câu khỏi bank (không xoá cứng).</summary>
        [HttpDelete("{bankItemId:long}")]
        public async Task<IActionResult> Deactivate(long bankItemId)
        {
            var ok = await _bankService.DeactivateAsync(_contextData.CompanyId, bankItemId);
            if (!ok)
                return NotFound(new { error = $"Không tìm thấy câu trong bank (bank_item_id={bankItemId})." });
            return NoContent();
        }
    }
}
