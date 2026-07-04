using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

public interface IUserRepo : IBaseRepo<Guid, User>
{
    Task<User> GetByEmail(string email);

    /// <summary>Toàn bộ user của công ty hiện tại (Admin quản lý tài khoản). Mới nhất trước.</summary>
    Task<IReadOnlyList<User>> GetListByCompanyAsync(long companyId);

    /// <summary>1 user theo id (lọc theo company). Null nếu không thuộc company.</summary>
    Task<User?> GetByIdAsync(long companyId, long userId);

    /// <summary>Email đã tồn tại trong công ty chưa (UNIQUE theo company_id, email).</summary>
    Task<bool> EmailExistsAsync(long companyId, string email, long? excludeUserId = null);

    /// <summary>Tạo user mới (set company_id), trả về user_id.</summary>
    Task<long> InsertAsync(long companyId, User user);

    /// <summary>Cập nhật hồ sơ + role + status. Trả số dòng (0 = không thấy).</summary>
    Task<int> UpdateAsync(long companyId, long userId, string? fullName, string? phone, string role, string status);

    /// <summary>Đổi mật khẩu (đã hash sẵn). Trả số dòng.</summary>
    Task<int> UpdatePasswordAsync(long companyId, long userId, string passwordHash);
}
