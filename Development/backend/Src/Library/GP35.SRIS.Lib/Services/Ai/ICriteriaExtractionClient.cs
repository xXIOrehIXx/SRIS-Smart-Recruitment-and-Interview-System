namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>
/// 1 tiêu chí AI bóc được từ JD (docs 5.18) — luôn là NHÁP cho người duyệt.
/// Chỉ còn tên + trọng số: 3 trường phân loại cũ phục vụ máy chấm CV, xoá cùng nó ở V038.
/// </summary>
public record ExtractedCriterion(string Name, decimal Weight);

/// <summary>
/// Gọi Python AI service (<c>POST {BaseUrl}/extract-criteria</c>) bóc tiêu chí từ JD qua Local LLM.
/// Lỗi (Ollama chưa chạy...) -> ném exception; caller ghi lượt bóc là FAILED để người dùng nhập tay.
/// <para>
/// Danh sách RỖNG là kết quả HỢP LỆ (JD chỉ liệt kê đầu việc), không phải lỗi — caller phân biệt.
/// </para>
/// </summary>
public interface ICriteriaExtractionClient
{
    Task<IReadOnlyList<ExtractedCriterion>> ExtractAsync(string jdText, CancellationToken ct = default);
}
