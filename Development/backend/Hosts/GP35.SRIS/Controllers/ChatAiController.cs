using GP35.SRIS.Domain.Shared.Configs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Json;

namespace GP35.SRIS.Controllers;

[Route("api/chat-ai")]
[ApiController]
[AllowAnonymous] // Hoặc xóa đi nếu bạn muốn bắt buộc Login mới được gọi
public class ChatAiController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly DefaultConfig _config;

    public ChatAiController(IHttpClientFactory httpClientFactory, DefaultConfig config)
    {
        _httpClientFactory = httpClientFactory;
        _config = config;
    }

    [HttpGet("models")]
    public async Task<IActionResult> GetModels(CancellationToken ct)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl)) return StatusCode(500, "Chưa cấu hình 'AiService:BaseUrl'.");

        using var client = _httpClientFactory.CreateClient();
        var url = $"{baseUrl}/models";
        
        var resp = await client.GetAsync(url, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        
        return Content(body, "application/json");
    }

    public class ChatRequestDto
    {
        public string Model { get; set; } = "";
        public string Message { get; set; } = "";
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequestDto req, CancellationToken ct)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl)) return StatusCode(500, "Chưa cấu hình 'AiService:BaseUrl'.");

        using var client = _httpClientFactory.CreateClient();
        client.Timeout = TimeSpan.FromMinutes(2); // AI trả lời có thể mất 30s-1p
        var url = $"{baseUrl}/chat";
        
        var resp = await client.PostAsJsonAsync(url, new { model = req.Model, message = req.Message }, ct);
        var body = await resp.Content.ReadAsStringAsync(ct);
        
        return Content(body, "application/json");
    }
}
