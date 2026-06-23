using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.EmailTemplate;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using TemplateEntity = GP35.SRIS.Domain.Entities.EmailTemplate;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>CRUD template email động (M4). Validate type thuộc danh mục trigger hợp lệ.</summary>
public class EmailTemplateService : BaseService<EmailTemplateService>, IEmailTemplateService
{
    private readonly IEmailTemplateRepo _repo;

    public EmailTemplateService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _repo = serviceProvider.GetRequiredService<IEmailTemplateRepo>();
    }

    public async Task<IReadOnlyList<EmailTemplateDto>> GetListAsync(long companyId)
    {
        var rows = await _repo.GetListAsync(companyId);
        return rows.Select(ToDto).ToList();
    }

    public async Task<EmailTemplateDto> GetByIdAsync(long companyId, long templateId)
    {
        var t = await _repo.GetByIdAsync(companyId, templateId)
            ?? throw NotFound(templateId);
        return ToDto(t);
    }

    public async Task<EmailTemplateDto> CreateAsync(long companyId, EmailTemplateUpsertDto dto)
    {
        Validate(dto);
        var entity = new TemplateEntity
        {
            Type = dto.Type.Trim().ToUpperInvariant(),
            Name = dto.Name?.Trim(),
            Subject = dto.Subject.Trim(),
            Body = dto.Body,
            IsActive = dto.IsActive
        };
        var id = await _repo.InsertAsync(companyId, entity);
        return await GetByIdAsync(companyId, id);
    }

    public async Task<EmailTemplateDto> UpdateAsync(long companyId, long templateId, EmailTemplateUpsertDto dto)
    {
        Validate(dto);
        var updated = await _repo.UpdateAsync(companyId, new TemplateEntity
        {
            TemplateId = templateId,
            Type = dto.Type.Trim().ToUpperInvariant(),
            Name = dto.Name?.Trim(),
            Subject = dto.Subject.Trim(),
            Body = dto.Body,
            IsActive = dto.IsActive
        }) ?? throw NotFound(templateId);
        return ToDto(updated);
    }

    public async Task DeleteAsync(long companyId, long templateId)
    {
        var deleted = await _repo.DeleteAsync(companyId, templateId);
        if (!deleted) throw NotFound(templateId);
    }

    // ============================================================

    private static void Validate(EmailTemplateUpsertDto dto)
    {
        if (!EmailTemplateType.IsValid(dto.Type))
            throw Bad($"Loại template không hợp lệ. Hợp lệ: {string.Join(", ", EmailTemplateType.All)}.");
        if (string.IsNullOrWhiteSpace(dto.Subject))
            throw Bad("Tiêu đề (subject) không được để trống.");
        if (string.IsNullOrWhiteSpace(dto.Body))
            throw Bad("Nội dung (body) không được để trống.");
    }

    private static EmailTemplateDto ToDto(TemplateEntity t) => new()
    {
        TemplateId = t.TemplateId,
        Type = t.Type,
        Name = t.Name,
        Subject = t.Subject,
        Body = t.Body,
        IsActive = t.IsActive,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt
    };

    private static BaseException NotFound(long id) => new($"Không tìm thấy template (template_id={id}).")
    {
        ErrorCode = "NOT_FOUND",
        ErrorMessage = $"Không tìm thấy template (template_id={id}).",
        HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };
}
