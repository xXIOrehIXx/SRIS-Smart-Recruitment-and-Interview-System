using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// Template email động (M4) — CRUD theo từng loại (trigger state machine + magic link). Cô lập
/// tenant qua Global Query Filter + RLS. NotificationService tra template active theo type rồi render.
/// </summary>
public interface IEmailTemplateRepo : IBaseRepo<long, EmailTemplate>
{
    Task<IReadOnlyList<EmailTemplate>> GetListAsync(long companyId);

    Task<EmailTemplate?> GetByIdAsync(long companyId, long templateId);

    /// <summary>Template đang active cho 1 loại (mới nhất nếu có nhiều). Null nếu chưa cấu hình.</summary>
    Task<EmailTemplate?> GetActiveByTypeAsync(long companyId, string type);

    Task<long> InsertAsync(long companyId, EmailTemplate template);

    /// <summary>Cập nhật subject/body/name/is_active. Trả entity sau cập nhật, null nếu không tồn tại.</summary>
    Task<EmailTemplate?> UpdateAsync(long companyId, EmailTemplate template);

    /// <summary>Xóa template. Trả true nếu có xóa.</summary>
    Task<bool> DeleteAsync(long companyId, long templateId);
}
