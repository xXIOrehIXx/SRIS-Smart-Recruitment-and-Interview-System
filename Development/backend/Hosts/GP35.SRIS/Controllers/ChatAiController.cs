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

    [HttpPost("chat/stream")]
    public async Task ChatStream([FromBody] ChatRequestDto req, CancellationToken ct)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            Response.StatusCode = 500;
            await Response.WriteAsync("Chưa cấu hình AiService:BaseUrl");
            return;
        }

        using var client = _httpClientFactory.CreateClient();
        client.Timeout = Timeout.InfiniteTimeSpan; // Stream không giới hạn timeout
        var url = $"{baseUrl}/chat/stream";
        
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = JsonContent.Create(new { model = req.Model, message = req.Message })
        };

        using var resp = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        
        Response.StatusCode = (int)resp.StatusCode;
        Response.ContentType = resp.Content.Headers.ContentType?.ToString() ?? "application/x-ndjson";
        
        var stream = await resp.Content.ReadAsStreamAsync(ct);
        await stream.CopyToAsync(Response.Body, ct);
    }
}
