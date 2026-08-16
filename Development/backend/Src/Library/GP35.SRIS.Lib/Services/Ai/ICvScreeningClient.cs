namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>1 yêu cầu của JD mà CV chứng minh được, kèm câu trích nguyên văn từ CV.</summary>
public record MatchedRequirement(string Requirement, string Evidence);

/// <summary>
/// Kết quả AI đối chiếu 1 CV với 1 tin tuyển dụng.
/// <para>
/// <paramref name="Decision"/>: PROCEED | CONSIDER | REJECT — là ĐỀ XUẤT THAM KHẢO.
/// Hệ thống không tự loại và không tự đẩy hồ sơ sang state nào theo trường này; người
/// tuyển dụng đọc rồi tự quyết (xem CvScreeningService).
/// </para>
/// </summary>
public record CvScreeningResult(
    string Summary,
    IReadOnlyList<MatchedRequirement> Matched,
    IReadOnlyList<string> Missing,
    int FitScore,
    string Decision,
    string DecisionReason);

/// <summary>
/// Gọi Python AI service (<c>POST {BaseUrl}/screen-cv</c>) đối chiếu CV với JD qua Local LLM.
/// Lỗi (Ollama chưa chạy, model chưa pull, LLM trả rác) -> ném exception; caller ghi lượt
/// sàng lọc là FAILED.
/// </summary>
public interface ICvScreeningClient
{
    Task<CvScreeningResult> ScreenAsync(string cvText, string jdText, CancellationToken ct = default);
}
