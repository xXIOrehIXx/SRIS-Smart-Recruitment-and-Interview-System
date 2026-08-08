using GP35.SRIS.Application.Contracts.Dtos.EmailTemplate;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>CRUD template email động (M4). Human Resource/Admin cấu hình; cô lập tenant.</summary>
public interface IEmailTemplateService : IBaseService
{
    Task<IReadOnlyList<EmailTemplateDto>> GetListAsync(long companyId);
    Task<EmailTemplateDto> GetByIdAsync(long companyId, long templateId);
    /// <summary>
    /// Tạo bộ mẫu email dựng sẵn cho công ty (chỉ thêm loại còn thiếu, không đè mẫu đã sửa).
    /// Trả số mẫu vừa thêm. Gọi lúc mở tài khoản công ty và từ nút trên trang Mẫu Email.
    /// </summary>
    Task<int> EnsureDefaultsAsync(long companyId);

    Task<EmailTemplateDto> CreateAsync(long companyId, EmailTemplateUpsertDto dto);
    Task<EmailTemplateDto> UpdateAsync(long companyId, long templateId, EmailTemplateUpsertDto dto);
    Task DeleteAsync(long companyId, long templateId);
}
