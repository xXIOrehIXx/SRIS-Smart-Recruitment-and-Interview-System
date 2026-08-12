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

    public async Task<IReadOnlyList<ExtractedCriterion>> ExtractAsync(string jdText, CancellationToken ct = default)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("Chưa cấu hình 'AiService:BaseUrl'.");

        var url = $"{baseUrl}/extract-criteria";

        // Timeout riêng, rộng: Local LLM chạy CPU sinh JSON cho cả chục tiêu chí, lại còn tối đa
        // 3 lượt retry phía Python. Mặc định 100s của HttpClient cắt ngang giữa chừng thường xuyên.
        var timeout = TimeSpan.FromSeconds(Math.Max(30, _config.AiService?.ExtractTimeoutSeconds ?? 300));

        // Dùng overload trả HttpResponseMessage (không phải SendAsync<T>): SendAsync<T> nuốt mọi
        // mã lỗi thành default(T), nên 502 "Ollama chưa chạy" và "AI trả rác" trông y hệt nhau.
        var resp = await _httpService.SendAsync(
            HttpMethod.Post, url, timeout, ct, headers: null, data: new { jd_text = jdText });

        var body = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            _logger.Here().Error("CriteriaExtractionClient: AI service trả {Status}. Url={Url} Body={Body}",
                (int)resp.StatusCode, url, Truncate(body));
            throw new InvalidOperationException(
                $"AI service trả lỗi {(int)resp.StatusCode} (kiểm tra AI service + Ollama đã chạy chưa).");
        }

        var parsed = JsonConvert.DeserializeObject<ExtractResponse>(body);

        // Thiếu hẳn trường 'criteria' = phản hồi không đúng hợp đồng -> ném.
        if (parsed?.Criteria == null)
        {
            _logger.Here().Error("CriteriaExtractionClient: thiếu trường 'criteria'. Url={Url} Body={Body}",
                url, Truncate(body));
            throw new InvalidOperationException("AI không phản hồi đúng định dạng.");
        }

        // Danh sách RỖNG là kết quả HỢP LỆ, không phải lỗi: JD chỉ liệt kê đầu việc mà không nêu
        // yêu cầu nào với ứng viên. Caller phân biệt hai ca này để báo đúng việc người dùng cần làm.
        return parsed.Criteria.Select(c => new ExtractedCriterion(
                (c.Name ?? "").Trim(),
                string.Equals(c.Type, "HARD", StringComparison.OrdinalIgnoreCase) ? "HARD" : "SOFT",
                c.CvMatchable,
                c.Keywords ?? new List<string>(),
                Math.Clamp(c.Weight, 0.1m, 5m)))
            .Where(c => c.Name.Length >= 2)
            .ToList();
    }

    /// <summary>Body lỗi có thể rất dài (traceback Python) — cắt trước khi vào log.</summary>
    private static string Truncate(string? s) =>
        string.IsNullOrEmpty(s) ? "" : s.Length <= 500 ? s : s[..500] + "...";

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
