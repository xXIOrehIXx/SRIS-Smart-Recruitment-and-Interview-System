using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 khuôn tiêu chí kèm các dòng của nó.</summary>
public record CriteriaTemplateWithItems(CriteriaTemplate Template, IReadOnlyList<CriteriaTemplateItem> Items);

/// <summary>Thư viện tiêu chí mẫu cấp company (Việc 12). Tenant-isolated.</summary>
public interface ICriteriaTemplateRepo : IBaseRepo<long, CriteriaTemplate>
{
    /// <summary>Tạo khuôn + các dòng trong 1 transaction. Trả template_id.</summary>
    Task<long> InsertWithItemsAsync(long companyId, CriteriaTemplate template, IEnumerable<CriteriaTemplateItem> items);

    /// <summary>Mọi khuôn của company (không kèm item). activeOnly = chỉ khuôn đang bật.</summary>
    Task<IReadOnlyList<CriteriaTemplate>> GetAllAsync(long companyId, bool activeOnly);

    /// <summary>Đếm số dòng của từng khuôn (cho danh sách). Trả map template_id -> số dòng.</summary>
    Task<IReadOnlyDictionary<long, int>> GetItemCountsAsync(long companyId);

    /// <summary>1 khuôn kèm dòng (order theo display_order). Null nếu không thuộc company.</summary>
    Task<CriteriaTemplateWithItems?> GetByIdAsync(long companyId, long templateId);

    /// <summary>
    /// Cập nhật header + THAY toàn bộ dòng của khuôn trong 1 transaction.
    /// Trả false nếu khuôn không tồn tại trong company.
    /// </summary>
    Task<bool> UpdateWithItemsAsync(
        long companyId, long templateId, string name, string? description, bool active,
        IEnumerable<CriteriaTemplateItem> items);

    /// <summary>Ẩn 1 khuôn (active = 0). Trả false nếu không tìm thấy.</summary>
    Task<bool> DeactivateAsync(long companyId, long templateId);
}
