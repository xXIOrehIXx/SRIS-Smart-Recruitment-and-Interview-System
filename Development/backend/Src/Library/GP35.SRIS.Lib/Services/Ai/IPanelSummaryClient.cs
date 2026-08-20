namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>1 note theo tiêu chí trong phiếu chấm — đầu vào cho AI đọc.</summary>
public record PanelCriterionNote(string CriteriaName, string Note);

/// <summary>1 phiếu chấm ĐÃ NỘP đưa cho AI đọc (blind review đã mở — 5.7).</summary>
public record PanelVerdictInput(
    string Interviewer,
    int? RoundNumber,
    string? Recommendation,
    string? Summary,
    IReadOnlyList<PanelCriterionNote> Notes);

/// <summary>
/// Kết quả AI tổng hợp ý kiến hội đồng phỏng vấn.
/// <para>
/// KHÔNG có trường "nên tuyển": AI chỉ gom ý kiến, không kết luận. Quyền quyết tuyển thuộc
/// Giám đốc (V043) — thêm một trường kết luận vào đây là biến gợi ý của model thành thứ
/// người ta bấm theo, đúng ranh giới đã giữ ở sàng lọc CV (V044).
/// </para>
/// </summary>
public record PanelSummaryResult(
    string Consensus,
    IReadOnlyList<string> Agreements,
    IReadOnlyList<string> Disagreements,
    IReadOnlyList<string> OpenQuestions);

/// <summary>
/// Gọi Python AI service (<c>POST {BaseUrl}/summarize-panel</c>) gom các phiếu chấm của một
/// ứng viên. Lỗi (Ollama chưa chạy, LLM trả rác) -> ném exception; caller ghi lượt tổng hợp
/// là FAILED và màn quyết định vẫn đọc được phiếu gốc như trước.
/// </summary>
public interface IPanelSummaryClient
{
    Task<PanelSummaryResult> SummarizeAsync(
        string candidate, IReadOnlyList<PanelVerdictInput> verdicts, CancellationToken ct = default);
}
