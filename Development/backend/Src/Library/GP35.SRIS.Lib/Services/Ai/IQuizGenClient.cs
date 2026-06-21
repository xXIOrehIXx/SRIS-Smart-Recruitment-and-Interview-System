using Newtonsoft.Json;

namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>
/// Client gọi Python AI service để sinh quiz trắc nghiệm (MCQ) từ JD bằng Local LLM.
/// Ném <see cref="QuizGenException"/> khi AI không sinh được quiz (để service kích hoạt
/// fallback "HR nhập tay" — 5.6).
/// </summary>
public interface IQuizGenClient
{
    /// <summary>
    /// Sinh <paramref name="numQuestions"/> câu hỏi MCQ từ JD.
    /// </summary>
    /// <param name="jdText">Mô tả công việc (chỉ để AI biết ngành/chủ đề cần kiểm tra).</param>
    /// <param name="numQuestions">Số câu cần sinh (>= 1).</param>
    /// <param name="topic">Ràng buộc 1 chủ đề (nút "Thêm câu theo chủ đề"). Null = không ràng buộc.</param>
    /// <param name="avoid">Các câu đã có để AI tránh trùng (gen thêm / gen lại). Null = không có.</param>
    Task<List<GeneratedQuizQuestion>> GenerateAsync(
        string jdText, int numQuestions, string? topic = null, IEnumerable<string>? avoid = null);
}

/// <summary>1 câu hỏi MCQ thô do AI sinh (chưa lưu DB). 4 phương án + chỉ số đáp án đúng.</summary>
public class GeneratedQuizQuestion
{
    [JsonProperty("question")]
    public string Question { get; set; } = null!;

    [JsonProperty("options")]
    public List<string> Options { get; set; } = new();

    [JsonProperty("correct_index")]
    public int CorrectIndex { get; set; }
}

/// <summary>Ném khi AI service không sinh được quiz (Ollama chưa chạy / lỗi / trả rỗng).</summary>
public class QuizGenException : Exception
{
    public QuizGenException(string message) : base(message) { }
}
