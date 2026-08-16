using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Serilog;

namespace GP35.SRIS.Lib.Services.Ai;

public class CvScreeningClient : ICvScreeningClient
{
    /// <summary>Các giá trị hợp lệ của <c>decision</c>. Phải khớp Literal bên Python.</summary>
    private static readonly HashSet<string> ValidDecisions =
        new(StringComparer.OrdinalIgnoreCase) { "PROCEED", "CONSIDER", "REJECT" };

    private readonly IHttpService _httpService;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public CvScreeningClient(IServiceProvider serviceProvider)
    {
        _httpService = serviceProvider.GetRequiredService<IHttpService>();
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CvScreeningClient>();
    }

    public async Task<CvScreeningResult> ScreenAsync(string cvText, string jdText, CancellationToken ct = default)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("Chưa cấu hình 'AiService:BaseUrl'.");

        var url = $"{baseUrl}/screen-cv";

        // Timeout rộng hơn cả lượt bóc tiêu chí: prompt ở đây chứa CẢ CV lẫn JD, và model
        // dùng cho việc này (qwen3:8b) lớn hơn model bóc tiêu chí. Worker chạy nền nên không
        // ai ngồi đợi con số này.
        var timeout = TimeSpan.FromSeconds(Math.Max(30, _config.AiService?.ScreenCvTimeoutSeconds ?? 420));

        // Overload trả HttpResponseMessage (không phải SendAsync<T>): SendAsync<T> nuốt mọi mã
        // lỗi thành default(T) nên "Ollama chưa chạy" và "AI trả rác" trông y hệt nhau.
        var resp = await _httpService.SendAsync(
            HttpMethod.Post, url, timeout, ct, headers: null,
            data: new { cv_text = cvText, jd_text = jdText });

        var body = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            _logger.Here().Error("CvScreeningClient: AI service trả {Status}. Url={Url} Body={Body}",
                (int)resp.StatusCode, url, Truncate(body));
            throw new InvalidOperationException(
                $"AI service trả lỗi {(int)resp.StatusCode} (kiểm tra AI service + Ollama đã chạy chưa).");
        }

        var parsed = JsonConvert.DeserializeObject<ScreenResponse>(body);

        // Thiếu tóm tắt = phản hồi không đúng hợp đồng. Đây cũng là trường DUY NHẤT bắt buộc
        // phải có: matched/missing rỗng đều là kết quả hợp lệ (ứng viên lệch hẳn ngành thì
        // matched rỗng; JD sơ sài thì missing rỗng).
        if (parsed is null || string.IsNullOrWhiteSpace(parsed.Summary))
        {
            _logger.Here().Error("CvScreeningClient: thiếu trường 'summary'. Url={Url} Body={Body}",
                url, Truncate(body));
            throw new InvalidOperationException("AI không phản hồi đúng định dạng.");
        }

        // Kẹp lại dù Pydantic đã chặn: .NET và Python là hai tiến trình riêng (model đổi được
        // qua biến môi trường, địa chỉ AI service nằm trong config) nên không tin mù đầu vào.
        var matched = (parsed.Matched ?? [])
            .Select(m => new MatchedRequirement((m.Requirement ?? "").Trim(), (m.Evidence ?? "").Trim()))
            .Where(m => m.Requirement.Length > 0 && m.Evidence.Length > 0)
            .ToList();

        var missing = (parsed.Missing ?? [])
            .Select(s => (s ?? "").Trim())
            .Where(s => s.Length > 0)
            .ToList();

        // Giá trị lạ -> CONSIDER, KHÔNG phải REJECT: mặc định an toàn là "người xem lại",
        // không bao giờ là gợi ý loại một ứng viên vì một trường bị hỏng.
        var decision = ValidDecisions.Contains(parsed.Decision ?? "")
            ? parsed.Decision!.ToUpperInvariant()
            : "CONSIDER";

        return new CvScreeningResult(
            parsed.Summary.Trim(),
            matched,
            missing,
            Math.Clamp(parsed.FitScore, 0, 100),
            decision,
            (parsed.DecisionReason ?? "").Trim());
    }

    /// <summary>Body lỗi có thể rất dài (traceback Python) — cắt trước khi vào log.</summary>
    private static string Truncate(string? s) =>
        string.IsNullOrEmpty(s) ? "" : s.Length <= 500 ? s : s[..500] + "...";

    private class ScreenResponse
    {
        [JsonProperty("summary")]
        public string? Summary { get; set; }

        [JsonProperty("matched")]
        public List<MatchedJson>? Matched { get; set; }

        [JsonProperty("missing")]
        public List<string?>? Missing { get; set; }

        [JsonProperty("fit_score")]
        public int FitScore { get; set; }

        [JsonProperty("decision")]
        public string? Decision { get; set; }

        [JsonProperty("decision_reason")]
        public string? DecisionReason { get; set; }
    }

    private class MatchedJson
    {
        [JsonProperty("requirement")]
        public string? Requirement { get; set; }

        [JsonProperty("evidence")]
        public string? Evidence { get; set; }
    }
}
