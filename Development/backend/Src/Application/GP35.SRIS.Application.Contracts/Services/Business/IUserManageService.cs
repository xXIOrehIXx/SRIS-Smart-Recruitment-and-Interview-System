using GP35.SRIS.Application.Contracts.Dtos.Business.User;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Admin quản lý tài khoản nội bộ của công ty (docs 2 — "Quản lý user, gán role").
/// Role gán chồng (5.16) nhưng schema 1 role/user; đa vai xử lý sau nếu cần.
/// </summary>
public interface IUserManageService : IBaseService
{
    Task<IReadOnlyList<UserListItemDto>> GetListAsync(long companyId);
    Task<UserListItemDto> GetByIdAsync(long companyId, long userId);
    Task<UserListItemDto> CreateAsync(long companyId, UserCreateDto dto);
    Task<UserListItemDto> UpdateAsync(long companyId, long userId, UserUpdateDto dto);
    Task ResetPasswordAsync(long companyId, long userId, string newPassword);

    /// <summary>Vô hiệu tài khoản (soft — Status "Disabled"; không xóa cứng để giữ audit/lịch sử chấm).</summary>
    Task DisableAsync(long companyId, long userId);
}
