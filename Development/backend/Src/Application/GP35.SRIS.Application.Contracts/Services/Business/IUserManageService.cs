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

    /// <summary>
    /// Người đang đăng nhập tự sửa hồ sơ mình (tên + SĐT). Giữ nguyên Role/Status hiện có —
    /// KHÔNG dùng UpdateAsync cho việc này vì DTO của Admin bắt buộc Role và mặc định Status="Active".
    /// </summary>
    Task<UserListItemDto> UpdateOwnProfileAsync(long companyId, long userId, ProfileUpdateDto dto);

    /// <summary>
    /// Người đang đăng nhập đổi ảnh đại diện của CHÍNH MÌNH: kiểm tra định dạng/kích thước,
    /// đẩy file lên storage rồi lưu object key. Trả URL xem được (presigned) của ảnh mới.
    /// </summary>
    Task<string?> UpdateOwnAvatarAsync(
        long companyId, long userId, string fileName, string? contentType, byte[] content);

    /// <summary>
    /// Gỡ ảnh đại diện (về mặc định chữ cái đầu). Chỉ xóa tham chiếu trong DB — file cũ để lại
    /// trên storage, không xóa cứng (đúng nếp CV: giữ file cho audit, rẻ hơn là dọn ngay).
    /// </summary>
    Task RemoveOwnAvatarAsync(long companyId, long userId);

    /// <summary>Vô hiệu tài khoản (soft — Status "Disabled"; không xóa cứng để giữ audit/lịch sử chấm).</summary>
    Task DisableAsync(long companyId, long userId);

    /// <summary>Danh sách user Active rút gọn cho dropdown chọn người; role null = mọi role.</summary>
    Task<IReadOnlyList<UserOptionDto>> GetOptionsAsync(long companyId, string? role);
}
