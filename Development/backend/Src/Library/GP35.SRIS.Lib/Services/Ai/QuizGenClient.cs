using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Extensions;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Serilog;

namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>
/// Gọi Python AI service (<c>POST {BaseUrl}/generate-quiz</c>) để sinh quiz MCQ từ JD.
/// LLM chạy CPU có thể lâu -> dùng overload SendAsync có timeout (5 phút) và tự bóc lỗi
/// 502 từ AI service để ném <see cref="QuizGenException"/> (service sẽ fallback HR nhập tay).
/// </summary>
public class QuizGenClient : IQuizGenClient
{
    // LLM local có thể mất 15-20s/lượt, gen nhiều câu lâu hơn -> nới rộng timeout.
    private static readonly TimeSpan Timeout = TimeSpan.FromMinutes(5);

    private readonly IHttpService _httpService;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public QuizGenClient(IServiceProvider serviceProvider)
    {
        _httpService = serviceProvider.GetRequiredService<IHttpService>();
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<QuizGenClient>();
    }

    public async Task<List<GeneratedQuizQuestion>> GenerateAsync(
        string jdText, int numQuestions, string? topic = null, IEnumerable<string>? avoid = null)
    {
        var baseUrl = _config.AiService?.BaseUrl?.TrimEnd('/');
        if (string.IsNullOrWhiteSpace(baseUrl))
            throw new InvalidOperationException("Chưa cấu hình 'AiService:BaseUrl'.");

        if (string.IsNullOrWhiteSpace(jdText))
            throw new QuizGenException("Job chưa có mô tả công việc (jd_text) nên không thể sinh quiz.");

        var url = $"{baseUrl}/generate-quiz";
        var payload = new
        {
            jd_text = jdText,
            num_questions = numQuestions,
            topic,
            avoid = avoid?.ToList()
        };

        try
        {
            var resp = await _httpService.SendAsync(HttpMethod.Post, url, Timeout, headers: null, data: payload);
            var content = await resp.Content.ReadAsStringAsync();

            if (!resp.IsSuccessStatusCode)
            {
                // Python trả 502 kèm lý do khi gen thất bại (Ollama chưa chạy / retry hết lượt).
                _logger.Here().Warning(
                    "QuizGenClient: AI service trả lỗi {Status}. Url={Url} Detail={Detail}",
                    (int)resp.StatusCode, url, content);
                throw new QuizGenException(
                    "AI service không sinh được quiz (kiểm tra Ollama đã chạy chưa). " +
                    "Có thể nhập câu hỏi thủ công thay thế.");
            }

            var result = JsonConvert.DeserializeObject<GenerateQuizResponse>(content);
            if (result?.Questions == null || result.Questions.Count == 0)
                throw new QuizGenException("AI service trả về quiz rỗng.");

            return result.Questions;
        }
        catch (QuizGenException)
        {
            throw;
        }
        catch (TaskCanceledException ex)
        {
            _logger.Here().Warning(ex, "QuizGenClient: AI service phản hồi quá lâu (timeout). Url={Url}", url);
            throw new QuizGenException("AI service phản hồi quá lâu (timeout). Model LLM có thể đang chạy rất chậm.");
        }
        catch (HttpRequestException ex)
        {
            _logger.Here().Warning(ex, "QuizGenClient: không gọi được AI service. Url={Url}", url);
            throw new QuizGenException(
                "Không gọi được AI service (kiểm tra service đã chạy ở BaseUrl chưa).");
        }
    }

    /// <summary>Khuôn JSON nhận về từ Python /generate-quiz (snake_case khớp Python).</summary>
    private class GenerateQuizResponse
    {
        [JsonProperty("questions")]
        public List<GeneratedQuizQuestion>? Questions { get; set; }
    }
}
