using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Serilog;

namespace GP35.SRIS.Lib.Services.Ai;

public class PanelSummaryClient : IPanelSummaryClient
{
    private readonly IHttpService _httpService;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public PanelSummaryClient(IServiceProvider serviceProvider)
    {
        _httpService = serviceProvider.GetRequiredService<IHttpService>();
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<PanelSummaryClient>();
    }

    public async Task<PanelSummaryResult> SummarizeAsync(
        string candidate, IReadOnlyList<PanelVerdictInput> verdicts, CancellationToken ct = default)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("Chưa cấu hình 'AiService:BaseUrl'.");

        var url = $"{baseUrl}/summarize-panel";

        // Ngắn hơn hai việc kia: đầu vào là vài đoạn nhận xét ngắn. Worker chạy nền nên không
        // ai ngồi đợi con số này.
        var timeout = TimeSpan.FromSeconds(
            Math.Max(30, _config.AiService?.PanelSummaryTimeoutSeconds ?? 240));

        // Overload trả HttpResponseMessage (không phải SendAsync<T>): SendAsync<T> nuốt mọi mã
        // lỗi thành default(T) nên "Ollama chưa chạy" và "AI trả rác" trông y hệt nhau.
        var resp = await _httpService.SendAsync(
            HttpMethod.Post, url, timeout, ct, headers: null,
            data: new
            {
                candidate,
                verdicts = verdicts.Select(v => new
                {
                    interviewer = v.Interviewer,
                    round_number = v.RoundNumber,
                    recommendation = v.Recommendation,
                    summary = v.Summary,
                    notes = v.Notes.Select(n => new { criteria_name = n.CriteriaName, note = n.Note })
                })
            });

        var body = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            _logger.Here().Error("PanelSummaryClient: AI service trả {Status}. Url={Url} Body={Body}",
                (int)resp.StatusCode, url, Truncate(body));
            throw new InvalidOperationException(
                $"AI service trả lỗi {(int)resp.StatusCode} (kiểm tra AI service + Ollama đã chạy chưa).");
        }

        var parsed = JsonConvert.DeserializeObject<SummaryResponse>(body);

        // Consensus là trường DUY NHẤT bắt buộc: ba danh sách còn lại rỗng đều là kết quả hợp lệ
        // (cả hội đồng cùng ý -> không có mâu thuẫn; một phiếu -> không có đồng thuận).
        if (parsed is null || string.IsNullOrWhiteSpace(parsed.Consensus))
        {
            _logger.Here().Error("PanelSummaryClient: thiếu trường 'consensus'. Url={Url} Body={Body}",
                url, Truncate(body));
            throw new InvalidOperationException("AI không phản hồi đúng định dạng.");
        }

        return new PanelSummaryResult(
            parsed.Consensus.Trim(),
            Clean(parsed.Agreements),
            Clean(parsed.Disagreements),
            Clean(parsed.OpenQuestions));
    }

    /// <summary>Bỏ dòng trắng. Pydantic đếm ký tự trước khi trim nên "  " vẫn lọt qua bên Python.</summary>
    private static IReadOnlyList<string> Clean(List<string>? items) =>
        (items ?? new List<string>())
            .Select(x => (x ?? "").Trim())
            .Where(x => x.Length > 0)
            .ToList();

    /// <summary>Body lỗi có thể rất dài (traceback Python) — cắt trước khi vào log.</summary>
    private static string Truncate(string? s) =>
        string.IsNullOrEmpty(s) ? "" : s.Length <= 500 ? s : s[..500] + "...";

    private class SummaryResponse
    {
        [JsonProperty("consensus")]
        public string? Consensus { get; set; }

        [JsonProperty("agreements")]
        public List<string>? Agreements { get; set; }

        [JsonProperty("disagreements")]
        public List<string>? Disagreements { get; set; }

        [JsonProperty("open_questions")]
        public List<string>? OpenQuestions { get; set; }
    }
}
