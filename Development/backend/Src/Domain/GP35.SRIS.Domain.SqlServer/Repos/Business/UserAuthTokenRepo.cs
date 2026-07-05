using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

/// <summary>
/// UserAuthToken KHÔNG dưới RLS + không Global Query Filter (như Company) -> tra được pre-auth.
/// </summary>
public class UserAuthTokenRepo : BaseRepo<long, UserAuthToken>, IUserAuthTokenRepo
{
    private readonly SrisDbContext _db;

    public UserAuthTokenRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<long> InsertAsync(UserAuthToken token)
    {
        _db.UserAuthTokens.Add(token);
        await _db.SaveChangesAsync();
        return token.TokenId;
    }

    public async Task<UserAuthToken?> GetByHashAsync(string tokenHash, string purpose)
    {
        return await _db.UserAuthTokens.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && t.Purpose == purpose);
    }

    public async Task MarkUsedAsync(long tokenId)
    {
        await _db.UserAuthTokens
            .Where(t => t.TokenId == tokenId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, DateTime.UtcNow));
    }

    public async Task RevokeActiveAsync(long userId, string purpose)
    {
        await _db.UserAuthTokens
            .Where(t => t.UserId == userId && t.Purpose == purpose && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, DateTime.UtcNow));
    }
}
