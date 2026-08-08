namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>
/// Gọi Python AI service (<c>POST {BaseUrl}/summarize-cv</c>) tóm tắt CV qua Local LLM.
/// <para>
/// CHỈ trích xuất nội dung CV thành gạch đầu dòng — KHÔNG chấm điểm, KHÔNG so với JD,
/// KHÔNG xếp hạng (hệ thống đã bỏ hẳn việc máy đánh giá ứng viên). Client này cố tình
/// không nhận tham số JD/tiêu chí nào để ranh giới đó không trôi.
/// </para>
/// </summary>
public interface ICvSummaryClient
{
    /// <summary>
    /// Text đã bóc từ CV -> các gạch đầu dòng tóm tắt. Ném exception nếu AI service/Ollama
    /// không chạy hoặc LLM không ra JSON hợp lệ — caller quyết định nuốt hay báo lỗi.
    /// </summary>
    Task<IReadOnlyList<string>> SummarizeAsync(string cvText);
}
