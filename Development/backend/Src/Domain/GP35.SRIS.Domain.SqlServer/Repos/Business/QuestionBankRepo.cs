using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class QuestionBankRepo : BaseRepo<long, QuestionBankItem>, IQuestionBankRepo
{
    private readonly SrisDbContext _db;

    public QuestionBankRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<int> HarvestAsync(long companyId, IEnumerable<QuestionBankItem> candidates)
    {
        var list = candidates.ToList();
        if (list.Count == 0)
            return 0;

        // Nội dung đã có trong bank của company -> bỏ qua để không ghim trùng.
        var existing = await _db.QuestionBankItems
            .AsNoTracking()
            .Select(x => x.Content)
            .ToListAsync();
        var seen = new HashSet<string>(existing.Select(Normalize));

        var added = 0;
        foreach (var item in list)
        {
            var key = Normalize(item.Content);
            if (string.IsNullOrEmpty(key) || !seen.Add(key))
                continue; // trùng câu đã có hoặc trùng ngay trong lô này

            item.CompanyId = companyId;
            item.Active = true;
            item.ApprovedAt ??= DateTime.UtcNow;
            _db.QuestionBankItems.Add(item);
            added++;
        }

        if (added > 0)
            await _db.SaveChangesAsync();
        return added;
    }

    public async Task<(IReadOnlyList<QuestionBankItem> Items, int Total)> SearchAsync(
        long companyId, string? topic, string? search, int skip, int take)
    {
        var q = BuildFilter(topic, search);

        var total = await q.CountAsync();
        var items = await q
            .OrderByDescending(x => x.BankItemId)
            .Skip(Math.Max(0, skip))
            .Take(Math.Clamp(take, 1, 200))
            .ToListAsync();

        return (items, total);
    }

    public async Task<IReadOnlyList<QuestionBankItem>> PickAsync(
        long companyId, string? topic, int count, IReadOnlyCollection<string> excludeContents)
    {
        var exclude = new HashSet<string>((excludeContents ?? Array.Empty<string>()).Select(Normalize));

        // Lấy dư rồi lọc trùng ở bộ nhớ (so khớp đã chuẩn hoá — không làm được sạch trong SQL).
        var candidates = await BuildFilter(topic, null)
            .OrderByDescending(x => x.TimesUsed)   // ưu tiên câu "tốt" đã hay tái dùng
            .ThenByDescending(x => x.BankItemId)
            .Take(Math.Clamp(count, 1, 50) + exclude.Count)
            .ToListAsync();

        var picked = candidates
            .Where(x => !exclude.Contains(Normalize(x.Content)))
            .Take(Math.Clamp(count, 1, 50))
            .ToList();

        if (picked.Count > 0)
        {
            var ids = picked.Select(x => x.BankItemId).ToList();
            await _db.QuestionBankItems
                .Where(x => ids.Contains(x.BankItemId))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.TimesUsed, x => x.TimesUsed + 1)
                    .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
        }

        return picked;
    }

    public async Task<bool> DeactivateAsync(long companyId, long bankItemId)
    {
        var rows = await _db.QuestionBankItems
            .Where(x => x.BankItemId == bankItemId && x.Active)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Active, false)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
        return rows > 0;
    }

    private IQueryable<QuestionBankItem> BuildFilter(string? topic, string? search)
    {
        var q = _db.QuestionBankItems.AsNoTracking().Where(x => x.Active);

        if (!string.IsNullOrWhiteSpace(topic))
        {
            var t = topic.Trim();
            // Khớp cả cột topic lẫn nội dung (topic thường null khi harvest từ quiz).
            q = q.Where(x => (x.Topic != null && x.Topic.Contains(t)) || x.Content.Contains(t));
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(x => x.Content.Contains(s));
        }
        return q;
    }

    private static string Normalize(string? content) =>
        (content ?? string.Empty).Trim().ToLowerInvariant();
}
