using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Serilog;

namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>
/// Gọi Python AI service (<c>POST {BaseUrl}/embed</c>) để sinh vector embedding.
/// </summary>
public class EmbeddingClient : IEmbeddingClient
{
    private readonly IHttpService _httpService;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public EmbeddingClient(IServiceProvider serviceProvider)
    {
        _httpService = serviceProvider.GetRequiredService<IHttpService>();
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<EmbeddingClient>();
    }

    public async Task<float[]> EmbedAsync(string text)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("Chưa cấu hình 'AiService:BaseUrl'.");

        var url = $"{baseUrl}/embed";
        var resp = await _httpService.SendAsync<EmbedResponse>(
            HttpMethod.Post, url, headers: null, data: new { text });

        if (resp?.Vector == null || resp.Vector.Length == 0)
        {
            _logger.Here().Error("EmbeddingClient: AI service trả về vector rỗng. Url={Url}", url);
            throw new InvalidOperationException(
                "Không lấy được embedding từ AI service (kiểm tra service đã chạy ở BaseUrl chưa).");
        }

        return resp.Vector;
    }

    private class EmbedResponse
    {
        [JsonProperty("vector")]
        public float[]? Vector { get; set; }

        [JsonProperty("dim")]
        public int Dim { get; set; }
    }
}
