using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Serilog;

namespace GP35.SRIS.Lib.Services.Ai;

public class CriteriaExtractionClient : ICriteriaExtractionClient
{
    private readonly IHttpService _httpService;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public CriteriaExtractionClient(IServiceProvider serviceProvider)
    {
        _httpService = serviceProvider.GetRequiredService<IHttpService>();
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CriteriaExtractionClient>();
    }

    public async Task<IReadOnlyList<ExtractedCriterion>> ExtractAsync(string jdText)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("Chưa cấu hình 'AiService:BaseUrl'.");

        var url = $"{baseUrl}/extract-criteria";
        var resp = await _httpService.SendAsync<ExtractResponse>(
            HttpMethod.Post, url, headers: null, data: new { jd_text = jdText });

        // KHÔNG có body / thiếu hẳn trường 'criteria' = AI service hoặc Ollama có vấn đề -> ném.
        if (resp?.Criteria == null)
        {
            _logger.Here().Error("CriteriaExtractionClient: AI service không trả trường 'criteria'. Url={Url}", url);
            throw new InvalidOperationException(
                "AI không phản hồi đúng định dạng (kiểm tra AI service + Ollama đã chạy chưa).");
        }

        // Danh sách RỖNG là kết quả HỢP LỆ, không phải lỗi: JD chỉ liệt kê đầu việc mà không nêu
        // yêu cầu nào với ứng viên. Caller phân biệt hai ca này để báo đúng việc người dùng cần làm.
        return resp.Criteria.Select(c => new ExtractedCriterion(
                (c.Name ?? "").Trim(),
                string.Equals(c.Type, "HARD", StringComparison.OrdinalIgnoreCase) ? "HARD" : "SOFT",
                c.CvMatchable,
                c.Keywords ?? new List<string>(),
                Math.Clamp(c.Weight, 0.1m, 5m)))
            .Where(c => c.Name.Length >= 2)
            .ToList();
    }

    private class ExtractResponse
    {
        [JsonProperty("criteria")]
        public List<CriterionJson>? Criteria { get; set; }
    }

    private class CriterionJson
    {
        [JsonProperty("name")]
        public string? Name { get; set; }

        [JsonProperty("type")]
        public string? Type { get; set; }

        [JsonProperty("cv_matchable")]
        public bool CvMatchable { get; set; } = true;

        [JsonProperty("keywords")]
        public List<string>? Keywords { get; set; }

        [JsonProperty("weight")]
        public decimal Weight { get; set; } = 1;
    }
}
