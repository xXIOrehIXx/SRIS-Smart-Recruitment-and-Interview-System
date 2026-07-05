namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>1 tiêu chí AI bóc được từ JD (docs 5.18) — luôn là NHÁP cho người duyệt.</summary>
public record ExtractedCriterion(
    string Name, string Type, bool CvMatchable, IReadOnlyList<string> Keywords, decimal Weight);

/// <summary>
/// Gọi Python AI service (<c>POST {BaseUrl}/extract-criteria</c>) bóc tiêu chí từ JD qua Local LLM.
/// Lỗi (Ollama chưa chạy...) -> ném exception; caller kích hoạt fallback người nhập tay.
/// </summary>
public interface ICriteriaExtractionClient
{
    Task<IReadOnlyList<ExtractedCriterion>> ExtractAsync(string jdText);
}
