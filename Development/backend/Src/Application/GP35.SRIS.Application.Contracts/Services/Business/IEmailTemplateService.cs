using GP35.SRIS.Application.Contracts.Dtos.EmailTemplate;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>CRUD template email động (M4). Recruiter/Admin cấu hình; cô lập tenant.</summary>
public interface IEmailTemplateService : IBaseService
{
    Task<IReadOnlyList<EmailTemplateDto>> GetListAsync(long companyId);
    Task<EmailTemplateDto> GetByIdAsync(long companyId, long templateId);
    Task<EmailTemplateDto> CreateAsync(long companyId, EmailTemplateUpsertDto dto);
    Task<EmailTemplateDto> UpdateAsync(long companyId, long templateId, EmailTemplateUpsertDto dto);
    Task DeleteAsync(long companyId, long templateId);
}
