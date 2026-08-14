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
        // Kẹp lại dù Pydantic đã chặn: .NET và Python là hai tiến trình riêng (model đổi được
        // qua biến môi trường, địa chỉ AI service nằm trong config) nên không tin mù đầu vào.
        // Riêng Trim() thì KHÔNG thừa: tên "  " lọt min_length=2 của Pydantic vì đúng 2 ký tự,
        // trim xong mới lộ là rỗng — một dòng trắng trong phiếu chấm là dòng không ai chấm được.
        var tho = parsed.Criteria.Select(c => new ExtractedCriterion(
                (c.Name ?? "").Trim(),
                Math.Clamp(c.Weight, 0.1m, 5m)))
            .Where(c => c.Name.Length >= 2)
            .ToList();

        // Dọn bằng luật những thứ prompt đã dặn mà model vẫn không bỏ: dòng giấy tờ (bỏ hẳn) và
        // ngưỡng số năm (cắt, giữ phần chấm được). Xem CriteriaNameFilter để biết vì sao lọc ở
        // .NET chứ không viết thêm luật vào prompt.
        var loc = CriteriaNameFilter.Apply(tho);

        // Người dùng KHÔNG thấy dòng bị bỏ — chỉ log này phân biệt được "model đã khá lên" với
        // "regex đang giấu bớt". Cần khi đo lại prompt, và khi có người kêu thiếu tiêu chí.
        if (loc.Dropped.Count > 0 || loc.Rewritten.Count > 0)
        {
            _logger.Here().Information(
                "CriteriaExtractionClient: lọc {Raw} -> {Kept} tiêu chí. Bỏ=[{Dropped}] Sửa=[{Rewritten}]",
                tho.Count, loc.Criteria.Count,
                string.Join(" | ", loc.Dropped), string.Join(" | ", loc.Rewritten));
        }

        return loc.Criteria;
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

        [JsonProperty("weight")]
        public decimal Weight { get; set; } = 1;
    }
}
