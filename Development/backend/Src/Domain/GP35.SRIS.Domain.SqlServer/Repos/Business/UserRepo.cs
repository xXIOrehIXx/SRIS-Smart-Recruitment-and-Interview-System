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

    public async Task<IReadOnlyList<User>> GetListByCompanyAsync(long companyId)
    {
        // Global Query Filter tự kèm company_id.
        return await _db.Users.AsNoTracking()
            .OrderByDescending(u => u.UserId)
            .ToListAsync();
    }

    public async Task<User?> GetByIdAsync(long companyId, long userId)
    {
        return await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId);
    }

    public async Task<bool> EmailExistsAsync(long companyId, string email, long? excludeUserId = null)
    {
        return await _db.Users
            .Where(u => u.Email == email && (excludeUserId == null || u.UserId != excludeUserId))
            .AnyAsync();
    }

    public async Task<long> InsertAsync(long companyId, User user)
    {
        user.CompanyId = companyId;
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user.UserId;
    }

    public async Task<int> UpdateAsync(
        long companyId, long userId, string? fullName, string? phone, string role, string status)
    {
        return await _db.Users
            .Where(u => u.UserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.FullName, fullName)
                .SetProperty(u => u.Phone, phone)
                .SetProperty(u => u.Role, role)
                .SetProperty(u => u.Status, status)
                .SetProperty(u => u.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<int> UpdatePasswordAsync(long companyId, long userId, string passwordHash)
    {
        return await _db.Users
            .Where(u => u.UserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.PasswordHash, passwordHash)
                .SetProperty(u => u.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<long> InsertForNewCompanyAsync(long companyId, User user)
    {
        user.CompanyId = companyId;
        // Đăng ký chạy ẩn danh -> SESSION_CONTEXT('CompanyId') chưa set -> RLS BLOCK chặn insert.
        // Tắt policy trong lúc tạo Admin đầu tiên (pattern như GetByEmail). ALTER là trạng thái toàn DB.
        await _db.Database.ExecuteSqlRawAsync(
            "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = OFF);");
        try
        {
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            return user.UserId;
        }
        finally
        {
            await _db.Database.ExecuteSqlRawAsync(
                "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = ON);");
        }
    }

    public async Task TouchLastLoginAsync(long userId)
    {
        // Chạy ngay sau khi xác thực mật khẩu nhưng TRƯỚC khi có JWT -> SESSION_CONTEXT chưa set.
        // Tắt policy + IgnoreQueryFilters để update không bị RLS/filter nuốt (0 dòng).
        await WithPolicyOffAsync(async () =>
            await _db.Users
                .IgnoreQueryFilters()
                .Where(u => u.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastLoginAt, DateTime.UtcNow)));
    }

    public async Task<User?> GetByIdCrossTenantAsync(long userId)
    {
        // Refresh token chạy ẩn danh (chưa có JWT) -> tra XUYÊN tenant.
        return await WithPolicyOffAsync(async () =>
            await _db.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == userId));
    }

    public async Task UpdatePasswordCrossTenantAsync(long userId, string passwordHash)
    {
        // Reset mật khẩu qua email chạy ẩn danh -> update XUYÊN tenant.
        await WithPolicyOffAsync(async () =>
            await _db.Users
                .IgnoreQueryFilters()
                .Where(u => u.UserId == userId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(u => u.PasswordHash, passwordHash)
                    .SetProperty(u => u.UpdatedAt, DateTime.UtcNow)));
    }

    /// <summary>Chạy tác vụ với RLS policy tạm tắt (DB-level) — dùng cho các luồng auth ẩn danh.</summary>
    private async Task<T> WithPolicyOffAsync<T>(Func<Task<T>> action)
    {
        await _db.Database.ExecuteSqlRawAsync(
            "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = OFF);");
        try
        {
            return await action();
        }
        finally
        {
            await _db.Database.ExecuteSqlRawAsync(
                "ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = ON);");
        }
    }

    private async Task WithPolicyOffAsync(Func<Task> action) =>
        await WithPolicyOffAsync(async () => { await action(); return 0; });

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
