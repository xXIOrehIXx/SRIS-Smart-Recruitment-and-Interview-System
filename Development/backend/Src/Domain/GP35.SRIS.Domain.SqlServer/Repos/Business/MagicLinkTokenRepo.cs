using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class MagicLinkTokenRepo : BaseRepo<long, MagicLinkToken>, IMagicLinkTokenRepo
{
    private readonly SrisDbContext _db;

    public MagicLinkTokenRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(long companyId, MagicLinkToken token)
    {
        token.CompanyId = companyId;
        _db.MagicLinkTokens.Add(token);
        await _db.SaveChangesAsync();
        return token.TokenId;
    }

    public async Task<MagicLinkToken?> GetByHashAsync(long companyId, string tokenHash)
    {
        // Global Query Filter đã kèm company_id; hash là UNIQUE -> tối đa 1 dòng trong tenant.
        return await _db.MagicLinkTokens
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);
    }

    public async Task MarkUsedAsync(long companyId, long tokenId)
    {
        await _db.MagicLinkTokens
            .Where(t => t.TokenId == tokenId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, DateTime.UtcNow));
    }

    public async Task IncrementAccessAsync(long companyId, long tokenId)
    {
        await _db.MagicLinkTokens
            .Where(t => t.TokenId == tokenId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.AccessCount, t => t.AccessCount + 1));
    }
}
