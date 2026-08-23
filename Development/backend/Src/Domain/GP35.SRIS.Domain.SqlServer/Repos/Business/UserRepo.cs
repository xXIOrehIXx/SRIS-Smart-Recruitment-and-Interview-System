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

    public async Task<IReadOnlyList<User>> GetListByRoleAsync(long companyId, string role)
    {
        // Tìm user có role chứa tên role (role có thể là "Interviewer,Human Resource" nếu user giữ nhiều role).
        // Chỉ lấy user đang Active.
        return await _db.Users.AsNoTracking()
            .Where(u => u.Status == "Active" && u.Role.Contains(role))
            .OrderBy(u => u.FullName ?? u.Email)
            .ToListAsync();
    }

    public async Task<IReadOnlyList<User>> GetNamesByIdsAsync(long companyId, IReadOnlyList<long> userIds)
    {
        if (userIds.Count == 0) return Array.Empty<User>();
        return await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.UserId))
            // Kèm Role/Status: đủ để nơi gọi kiểm "id này có phải người dùng còn hoạt động không"
            // mà không phải bắn thêm một truy vấn User nữa.
            .Select(u => new User
            {
                UserId = u.UserId, FullName = u.FullName, Email = u.Email,
                Role = u.Role, Status = u.Status
            })
            .ToListAsync();
    }

    public async Task<User?> GetByIdAsync(long companyId, long userId)
    {
        return await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId);
    }

    public async Task<bool> EmailExistsAsync(string email, long? excludeUserId = null)
    {
        // Email duy nhất TOÀN HỆ THỐNG (V028) -> phải soi xuyên tenant, nếu không thì một email
        // đã dùng ở công ty khác sẽ lọt qua tầng service rồi vỡ ở UQ_User_email lúc INSERT.
        // Bỏ Global Query Filter + tắt RLS policy, cùng pattern với GetByEmail.
        return await WithSystemTenantAsync(async () =>
            await _db.Users
                .IgnoreQueryFilters()
                .Where(u => u.Email == email && (excludeUserId == null || u.UserId != excludeUserId))
                .AnyAsync());
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

    public async Task<int> UpdateAvatarAsync(long companyId, long userId, string? avatarObjectKey)
    {
        // Global Query Filter đã chặn theo company_id -> user công ty khác không lọt vào Where.
        return await _db.Users
            .Where(u => u.UserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.AvatarUrl, avatarObjectKey)
                .SetProperty(u => u.UpdatedAt, DateTime.UtcNow));
    }

    public async Task<long> InsertForNewCompanyAsync(long companyId, User user)
    {
        user.CompanyId = companyId;
        // Đăng ký chạy ẩn danh -> SESSION_CONTEXT('CompanyId') chưa set -> RLS BLOCK chặn insert.
        // Chạy dưới tenant hệ thống trong lúc tạo Admin đầu tiên (V049).
        return await WithSystemTenantAsync(async () =>
        {
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            return user.UserId;
        });
    }

    public async Task TouchLastLoginAsync(long userId)
    {
        // Chạy ngay sau khi xác thực mật khẩu nhưng TRƯỚC khi có JWT -> SESSION_CONTEXT chưa set.
        // Tắt policy + IgnoreQueryFilters để update không bị RLS/filter nuốt (0 dòng).
        await WithSystemTenantAsync(async () =>
            await _db.Users
                .IgnoreQueryFilters()
                .Where(u => u.UserId == userId)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastLoginAt, DateTime.UtcNow)));
    }

    public async Task<User?> GetByIdCrossTenantAsync(long userId)
    {
        // Refresh token chạy ẩn danh (chưa có JWT) -> tra XUYÊN tenant.
        return await WithSystemTenantAsync(async () =>
            await _db.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.UserId == userId));
    }

    public async Task UpdatePasswordCrossTenantAsync(long userId, string passwordHash)
    {
        // Reset mật khẩu qua email chạy ẩn danh -> update XUYÊN tenant.
        await WithSystemTenantAsync(async () =>
            await _db.Users
                .IgnoreQueryFilters()
                .Where(u => u.UserId == userId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(u => u.PasswordHash, passwordHash)
                    .SetProperty(u => u.UpdatedAt, DateTime.UtcNow)));
    }

    /// <summary>
    /// Chạy tác vụ dưới tenant "hệ thống" (V049) — dùng cho các luồng auth ẩn danh, lúc chưa
    /// biết người dùng thuộc công ty nào.
    ///
    /// Trước V049 chỗ này tắt hẳn TenantSecurityPolicy bằng DDL, tức tắt RLS cho TOÀN database
    /// trong lúc chạy: mọi request của tenant khác rơi đúng khoảng đó đọc được dữ liệu chéo.
    /// Giờ chỉ đóng dấu lên connection của chính mình. Đừng đổi ngược lại.
    /// </summary>
    private Task<T> WithSystemTenantAsync<T>(Func<Task<T>> action) => _db.RunAsSystemAsync(action);

    private Task WithSystemTenantAsync(Func<Task> action) => _db.RunAsSystemAsync(action);

    public async Task<User> GetByEmail(string email)
    {
        // Lúc login chưa biết company -> phải tra User XUYÊN tenant:
        //  - IgnoreQueryFilters(): bỏ Global Query Filter company_id ở tầng code.
        //  - Tenant hệ thống (V049) để RLS ở tầng DB cho qua, vì SESSION_CONTEXT chưa được set.
        return await WithSystemTenantAsync(async () =>
            await _db.Users
                .IgnoreQueryFilters()
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Email == email));
    }
}
