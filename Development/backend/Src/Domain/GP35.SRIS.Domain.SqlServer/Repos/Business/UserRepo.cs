using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class UserRepo : BaseRepo<Guid, User>, IUserRepo
{
    private readonly SrisDbContext _db;

    public UserRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _db = serviceProvider.GetRequiredService<SrisDbContext>();
    }

    public async Task<User> GetByEmail(string email)
    {
        // Lúc login chưa biết company -> phải tra User XUYÊN tenant:
        //  - IgnoreQueryFilters(): bỏ Global Query Filter company_id ở tầng code.
        //  - Tắt RLS policy (DB-level) trong lúc tra, vì SESSION_CONTEXT('CompanyId') chưa được set.
        // ALTER SECURITY POLICY là trạng thái toàn DB nên có hiệu lực bất kể connection nào EF dùng.
        await _db.Database.ExecuteSqlRawAsync(
            "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = OFF);");
        try
        {
            return await _db.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email == email);
        }
        finally
        {
            await _db.Database.ExecuteSqlRawAsync(
                "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = ON);");
        }
    }
}
