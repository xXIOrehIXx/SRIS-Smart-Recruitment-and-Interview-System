using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Serilog;

namespace GP35.SRIS.Lib.Services.Ai;

public class CvSummaryClient : ICvSummaryClient
{
    private readonly IHttpService _httpService;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public CvSummaryClient(IServiceProvider serviceProvider)
    {
        _httpService = serviceProvider.GetRequiredService<IHttpService>();
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CvSummaryClient>();
    }

    public async Task<IReadOnlyList<string>> SummarizeAsync(string cvText)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("Chưa cấu hình 'AiService:BaseUrl'.");

        var url = $"{baseUrl}/summarize-cv";
        var resp = await _httpService.SendAsync<SummaryResponse>(
            HttpMethod.Post, url, headers: null, data: new { cv_text = cvText });

        var lines = (resp?.Highlights ?? new List<string>())
            .Select(h => (h ?? "").Trim())
            .Where(h => h.Length > 0)
            .ToList();

        if (lines.Count == 0)
        {
            _logger.Here().Error("CvSummaryClient: AI service trả tóm tắt rỗng. Url={Url}", url);
            throw new InvalidOperationException(
                "AI không tóm tắt được CV (kiểm tra AI service + Ollama đã chạy chưa).");
        }

        return lines;
    }

    private class SummaryResponse
    {
        [JsonProperty("highlights")]
        public List<string>? Highlights { get; set; }
    }
}
