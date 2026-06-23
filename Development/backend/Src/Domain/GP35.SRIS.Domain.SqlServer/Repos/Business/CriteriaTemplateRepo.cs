using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CriteriaTemplateRepo : BaseRepo<long, CriteriaTemplate>, ICriteriaTemplateRepo
{
    private readonly SrisDbContext _db;

    public CriteriaTemplateRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertWithItemsAsync(
        long companyId, CriteriaTemplate template, IEnumerable<CriteriaTemplateItem> items)
    {
        template.CompanyId = companyId;
        template.Active = true;

        await using var tx = await _db.Database.BeginTransactionAsync();

        _db.CriteriaTemplates.Add(template);
        await _db.SaveChangesAsync();

        AddItems(companyId, template.TemplateId, items);
        await _db.SaveChangesAsync();

        await tx.CommitAsync();
        return template.TemplateId;
    }

    public async Task<IReadOnlyList<CriteriaTemplate>> GetAllAsync(long companyId, bool activeOnly)
    {
        var q = _db.CriteriaTemplates.AsNoTracking();
        if (activeOnly) q = q.Where(t => t.Active);
        return await q.OrderByDescending(t => t.TemplateId).ToListAsync();
    }

    public async Task<IReadOnlyDictionary<long, int>> GetItemCountsAsync(long companyId)
    {
        var counts = await _db.CriteriaTemplateItems
            .AsNoTracking()
            .GroupBy(i => i.TemplateId)
            .Select(g => new { TemplateId = g.Key, Count = g.Count() })
            .ToListAsync();
        return counts.ToDictionary(x => x.TemplateId, x => x.Count);
    }

    public async Task<CriteriaTemplateWithItems?> GetByIdAsync(long companyId, long templateId)
    {
        var template = await _db.CriteriaTemplates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TemplateId == templateId);
        if (template is null)
            return null;

        var items = await LoadItemsAsync(templateId);
        return new CriteriaTemplateWithItems(template, items);
    }

    public async Task<bool> UpdateWithItemsAsync(
        long companyId, long templateId, string name, string? description, bool active,
        IEnumerable<CriteriaTemplateItem> items)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();

        var rows = await _db.CriteriaTemplates
            .Where(t => t.TemplateId == templateId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Name, name)
                .SetProperty(t => t.Description, description)
                .SetProperty(t => t.Active, active)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));

        if (rows == 0)
        {
            await tx.RollbackAsync();
            return false;
        }

        // Thay toàn bộ dòng: xóa cũ rồi thêm mới (đơn giản, tránh diff từng dòng).
        await _db.CriteriaTemplateItems
            .Where(i => i.TemplateId == templateId)
            .ExecuteDeleteAsync();

        AddItems(companyId, templateId, items);
        await _db.SaveChangesAsync();

        await tx.CommitAsync();
        return true;
    }

    public async Task<bool> DeactivateAsync(long companyId, long templateId)
    {
        var rows = await _db.CriteriaTemplates
            .Where(t => t.TemplateId == templateId && t.Active)
            .ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Active, false)
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow));
        return rows > 0;
    }

    private void AddItems(long companyId, long templateId, IEnumerable<CriteriaTemplateItem> items)
    {
        foreach (var item in items)
        {
            item.CompanyId = companyId;
            item.TemplateId = templateId;
            _db.CriteriaTemplateItems.Add(item);
        }
    }

    private async Task<IReadOnlyList<CriteriaTemplateItem>> LoadItemsAsync(long templateId)
    {
        return await _db.CriteriaTemplateItems
            .AsNoTracking()
            .Where(i => i.TemplateId == templateId)
            .OrderBy(i => i.DisplayOrder)
            .ThenBy(i => i.ItemId)
            .ToListAsync();
    }
}
