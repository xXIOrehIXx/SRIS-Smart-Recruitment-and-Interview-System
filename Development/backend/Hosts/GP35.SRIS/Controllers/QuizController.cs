using GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.HostBase.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers
{
    /// <summary>
    /// Quiz AI (5.6): AI gen MCQ từ JD -> DRAFT -> Recruiter duyệt (DRAFT->READY).
    /// Các "nút hành động AI" (gen thêm / gen lại / thêm theo chủ đề) là lệnh gen đơn,
    /// stateless. Quiz chỉ READY mới phát cho ứng viên.
    /// </summary>
    [Route("api/quizzes")]
    [ApiController]
    [Authorize]
    [WithRole(RoleConstants.Recruiter)]
    public class QuizController : ControllerBase
    {
        private readonly IContextData _contextData;
        private readonly IQuizService _quizService;

        public QuizController(IContextData contextData, IQuizService quizService)
        {
            _contextData = contextData;
            _quizService = quizService;
        }

        /// <summary>AI gen quiz mới từ JD của job (tạo Quiz DRAFT + N câu hỏi).</summary>
        [HttpPost("jobs/{jobId:long}/generate")]
        public async Task<IActionResult> Generate(long jobId, [FromQuery] int numQuestions = 10)
        {
            var quiz = await _quizService.GenerateFromJdAsync(_contextData.CompanyId, jobId, numQuestions);
            return Ok(quiz);
        }

        /// <summary>Nút "Gen thêm N câu" — nối thêm câu vào quiz DRAFT.</summary>
        [HttpPost("{quizId:long}/questions/generate")]
        public async Task<IActionResult> AddQuestions(long quizId, [FromQuery] int count = 1)
        {
            var quiz = await _quizService.AddQuestionsAsync(_contextData.CompanyId, quizId, count);
            return Ok(quiz);
        }

        /// <summary>Nút "Thêm câu theo chủ đề" — gen 1 câu ràng buộc chủ đề, nối vào quiz DRAFT.</summary>
        [HttpPost("{quizId:long}/questions/by-topic")]
        public async Task<IActionResult> AddByTopic(long quizId, [FromBody] AddByTopicDto dto)
        {
            var quiz = await _quizService.AddByTopicAsync(_contextData.CompanyId, quizId, dto.Topic);
            return Ok(quiz);
        }

        /// <summary>Nút "Lấy từ ngân hàng" — kéo câu đã duyệt từ bank vào quiz DRAFT (tái dùng, không gọi AI).</summary>
        [HttpPost("{quizId:long}/questions/from-bank")]
        public async Task<IActionResult> AddFromBank(long quizId, [FromBody] AddFromBankDto dto)
        {
            var quiz = await _quizService.AddFromBankAsync(_contextData.CompanyId, quizId, dto);
            return Ok(quiz);
        }

        /// <summary>Nút "Gen lại câu này" — sinh 1 câu mới thay tại chỗ (giữ vị trí).</summary>
        [HttpPost("{quizId:long}/questions/{questionId:long}/regenerate")]
        public async Task<IActionResult> Regenerate(long quizId, long questionId)
        {
            var quiz = await _quizService.RegenerateQuestionAsync(_contextData.CompanyId, quizId, questionId);
            return Ok(quiz);
        }

        /// <summary>"Sửa tay" — Recruiter tự sửa nội dung/đáp án 1 câu (không gọi AI).</summary>
        [HttpPut("{quizId:long}/questions/{questionId:long}")]
        public async Task<IActionResult> UpdateQuestion(
            long quizId, long questionId, [FromBody] UpdateQuizQuestionDto dto)
        {
            var quiz = await _quizService.UpdateQuestionAsync(_contextData.CompanyId, quizId, questionId, dto);
            return Ok(quiz);
        }

        /// <summary>Recruiter duyệt: DRAFT -> READY.</summary>
        [HttpPost("{quizId:long}/approve")]
        public async Task<IActionResult> Approve(long quizId)
        {
            var quiz = await _quizService.ApproveAsync(_contextData.CompanyId, quizId);
            return Ok(quiz);
        }

        /// <summary>Xem 1 quiz kèm câu hỏi.</summary>
        [HttpGet("{quizId:long}")]
        public async Task<IActionResult> GetById(long quizId)
        {
            var quiz = await _quizService.GetByIdAsync(_contextData.CompanyId, quizId);
            if (quiz is null)
                return NotFound(new { error = $"Không tìm thấy quiz (quiz_id={quizId})." });
            return Ok(quiz);
        }

        /// <summary>Xem quiz mới nhất của 1 job.</summary>
        [HttpGet("jobs/{jobId:long}")]
        public async Task<IActionResult> GetLatestByJob(long jobId)
        {
            var quiz = await _quizService.GetLatestByJobAsync(_contextData.CompanyId, jobId);
            if (quiz is null)
                return NotFound(new { error = $"Job (jobId={jobId}) chưa có quiz nào." });
            return Ok(quiz);
        }
    }
}
