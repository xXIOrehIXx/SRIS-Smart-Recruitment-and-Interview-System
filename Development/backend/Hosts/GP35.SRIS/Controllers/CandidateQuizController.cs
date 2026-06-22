using GP35.SRIS.Application.Contracts.Dtos.Candidate.Quiz;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GP35.SRIS.Controllers;

/// <summary>
/// Cổng CÔNG KHAI cho ứng viên làm quiz qua magic link (docs 5.6) — KHÔNG đăng nhập.
/// Mọi endpoint nhận token qua query "?token=" (purpose=QUIZ). CandidateTenantMiddleware đọc
/// tiền tố companyId của token để set tenant (RLS) trước khi controller chạy. Service xác thực
/// token (hash/hết hạn/đã dùng) cho từng request.
/// </summary>
[Route("api/candidate/quiz")]
[ApiController]
[AllowAnonymous]
public class CandidateQuizController : ControllerBase
{
    private readonly ICandidateQuizService _quizService;

    public CandidateQuizController(ICandidateQuizService quizService)
    {
        _quizService = quizService;
    }

    /// <summary>Mở/khôi phục bài thi: trả đề (ẩn đáp án) + số giây còn lại.</summary>
    [HttpGet]
    public async Task<IActionResult> Start([FromQuery] string token)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        return Ok(await _quizService.StartAsync(token, ip));
    }

    /// <summary>Lưu 1 đáp án nháp (chưa chốt).</summary>
    [HttpPost("answers")]
    public async Task<IActionResult> SaveAnswer([FromQuery] string token, [FromBody] SaveAnswerDto dto)
    {
        await _quizService.SaveAnswerAsync(token, dto);
        return NoContent();
    }

    /// <summary>FE báo 1 sự kiện anti-cheat (tab switch, paste, blur...).</summary>
    [HttpPost("events")]
    public async Task<IActionResult> RecordEvent([FromQuery] string token, [FromBody] AntiCheatEventDto dto)
    {
        return Ok(await _quizService.RecordEventAsync(token, dto));
    }

    /// <summary>Ứng viên CHỐT nộp bài (đốt token).</summary>
    [HttpPost("submit")]
    public async Task<IActionResult> Submit([FromQuery] string token)
    {
        return Ok(await _quizService.SubmitAsync(token));
    }
}
