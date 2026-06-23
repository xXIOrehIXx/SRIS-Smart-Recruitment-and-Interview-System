using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// Ngân hàng câu hỏi đã duyệt (5.6 / Việc 12). Bank tự bồi từ luồng AI gen -> duyệt;
/// quiz mới có thể kéo câu từ bank thay vì gen lại (đỡ token, né trùng). Tenant-isolated.
/// </summary>
public interface IQuestionBankRepo : IBaseRepo<long, QuestionBankItem>
{
    /// <summary>
    /// Ghim các câu (đã duyệt) vào bank, BỎ những câu trùng nội dung đã có sẵn trong company.
    /// Trả về số câu thực sự được thêm.
    /// </summary>
    Task<int> HarvestAsync(long companyId, IEnumerable<QuestionBankItem> candidates);

    /// <summary>Tìm câu trong bank (chỉ active) theo chủ đề/từ khoá; mới nhất trước. Trả kèm tổng số.</summary>
    Task<(IReadOnlyList<QuestionBankItem> Items, int Total)> SearchAsync(
        long companyId, string? topic, string? search, int skip, int take);

    /// <summary>
    /// Lấy tối đa <paramref name="count"/> câu active khớp chủ đề/từ khoá, BỎ các nội dung trong
    /// <paramref name="excludeContents"/> (tránh trùng câu đã có trong quiz đích). Tăng times_used cho câu trả về.
    /// </summary>
    Task<IReadOnlyList<QuestionBankItem>> PickAsync(
        long companyId, string? topic, int count, IReadOnlyCollection<string> excludeContents);

    /// <summary>Ẩn 1 câu khỏi bank (active = 0). Trả false nếu không tìm thấy trong company.</summary>
    Task<bool> DeactivateAsync(long companyId, long bankItemId);
}
