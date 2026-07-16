using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

public interface IUserRepo : IBaseRepo<Guid, User>
{
    Task<User> GetByEmail(string email);

    /// <summary>Toàn bộ user của công ty hiện tại (Admin quản lý tài khoản). Mới nhất trước.</summary>
    Task<IReadOnlyList<User>> GetListByCompanyAsync(long companyId);

    /// <summary>
    /// Lấy user có role chứa tên role chỉ định trong công ty hiện tại (dùng cho Recruiter chọn
    /// interviewer khi tạo pool lịch phỏng vấn — không qua Admin).
    /// </summary>
    Task<IReadOnlyList<User>> GetListByRoleAsync(long companyId, string role);

    /// <summary>
    /// Lấy tên + email nhiều user theo id (dùng để hiển thị panel interviewer — không fetch cả User).
    /// </summary>
    Task<IReadOnlyList<User>> GetNamesByIdsAsync(long companyId, IReadOnlyList<long> userIds);

    /// <summary>1 user theo id (lọc theo company). Null nếu không thuộc company.</summary>
    Task<User?> GetByIdAsync(long companyId, long userId);

    /// <summary>Email đã tồn tại trong công ty chưa (UNIQUE theo company_id, email).</summary>
    Task<bool> EmailExistsAsync(long companyId, string email, long? excludeUserId = null);

    /// <summary>Tạo user mới (set company_id), trả về user_id.</summary>
    Task<long> InsertAsync(long companyId, User user);

    /// <summary>
    /// Tạo Admin đầu tiên lúc ĐĂNG KÝ công ty — chạy ẩn danh (SESSION_CONTEXT chưa set) nên
    /// RLS BLOCK sẽ chặn: tạm tắt policy trong lúc insert (pattern như GetByEmail). Trả user_id.
    /// </summary>
    Task<long> InsertForNewCompanyAsync(long companyId, User user);

    /// <summary>Ghi mốc đăng nhập gần nhất. Chạy pre-auth (login ẩn danh) -> bỏ RLS/filter theo user_id.</summary>
    Task TouchLastLoginAsync(long userId);

    /// <summary>Tra user theo id XUYÊN tenant (dùng cho refresh token — chạy ẩn danh). Null nếu không có.</summary>
    Task<User?> GetByIdCrossTenantAsync(long userId);

    /// <summary>Đổi mật khẩu XUYÊN tenant (dùng cho reset qua email — chạy ẩn danh).</summary>
    Task UpdatePasswordCrossTenantAsync(long userId, string passwordHash);

    /// <summary>Cập nhật hồ sơ + role + status. Trả số dòng (0 = không thấy).</summary>
    Task<int> UpdateAsync(long companyId, long userId, string? fullName, string? phone, string role, string status);

    /// <summary>Đổi mật khẩu (đã hash sẵn). Trả số dòng.</summary>
    Task<int> UpdatePasswordAsync(long companyId, long userId, string passwordHash);
}
