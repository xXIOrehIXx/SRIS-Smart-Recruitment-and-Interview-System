using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class EmailTemplateRepo : BaseRepo<long, EmailTemplate>, IEmailTemplateRepo
{
    private readonly SrisDbContext _db;

    public EmailTemplateRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<IReadOnlyList<EmailTemplate>> GetListAsync(long companyId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.EmailTemplates
            .AsNoTracking()
            .OrderBy(t => t.Type).ThenByDescending(t => t.TemplateId)
            .ToListAsync();
    }

    public async Task<EmailTemplate?> GetByIdAsync(long companyId, long templateId)
    {
        return await _db.EmailTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TemplateId == templateId);
    }

    public async Task<EmailTemplate?> GetActiveByTypeAsync(long companyId, string type)
    {
        return await _db.EmailTemplates
            .AsNoTracking()
            .Where(t => t.Type == type && t.IsActive)
            .OrderByDescending(t => t.TemplateId)
            .FirstOrDefaultAsync();
    }

    public async Task<long> InsertAsync(long companyId, EmailTemplate template)
    {
        template.CompanyId = companyId;
        _db.EmailTemplates.Add(template);
        await _db.SaveChangesAsync();
        return template.TemplateId;
    }

    public async Task<EmailTemplate?> UpdateAsync(long companyId, EmailTemplate template)
    {
        var existing = await _db.EmailTemplates
            .FirstOrDefaultAsync(t => t.TemplateId == template.TemplateId);
        if (existing is null) return null;

        existing.Type = template.Type;
        existing.Name = template.Name;
        existing.Subject = template.Subject;
        existing.Body = template.Body;
        existing.IsActive = template.IsActive;
        existing.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return existing;
    }

    public async Task<bool> DeleteAsync(long companyId, long templateId)
    {
        var existing = await _db.EmailTemplates
            .FirstOrDefaultAsync(t => t.TemplateId == templateId);
        if (existing is null) return false;

        _db.EmailTemplates.Remove(existing);
        await _db.SaveChangesAsync();
        return true;
    }
}
