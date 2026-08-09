using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.User;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services;
using GP35.SRIS.Storage;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using UserEntity = GP35.SRIS.Domain.Entities.User;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>Admin quản lý tài khoản nội bộ (docs 2). Mật khẩu hash SHA256WithSalt như luồng login.</summary>
public class UserManageService : BaseService<UserManageService>, IUserManageService
{
    // Cùng salt cố định với AuthService.LoginAsync — đổi thì cả 2 chỗ phải đổi.
    private const string PasswordSalt = "salt";

    /// <summary>Ảnh đại diện: chỉ nhận ảnh thường gặp, tối đa 2MB (ảnh 100px trên UI, không cần hơn).</summary>
    private const long MaxAvatarBytes = 2 * 1024 * 1024;

    private static readonly HashSet<string> AllowedAvatarExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp" };

    private static readonly HashSet<string> AllowedAvatarContentTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp" };

    private readonly IUserRepo _userRepo;
    private readonly IEncodeService _encode;
    private readonly IFileStorageService _fileStorage;
    private readonly ILogger _logger;

    public UserManageService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _userRepo = serviceProvider.GetRequiredService<IUserRepo>();
        _encode = serviceProvider.GetRequiredService<IEncodeService>();
        _fileStorage = serviceProvider.GetRequiredService<IFileStorageService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<UserManageService>();
    }

    public async Task<IReadOnlyList<UserListItemDto>> GetListAsync(long companyId)
    {
        var users = await _userRepo.GetListByCompanyAsync(companyId);
        return users.Select(Map).ToList();
    }

    public async Task<UserListItemDto> GetByIdAsync(long companyId, long userId)
    {
        var user = await _userRepo.GetByIdAsync(companyId, userId)
            ?? throw NotFound($"Không tìm thấy tài khoản (user_id={userId}).");
        var dto = Map(user);
        dto.AvatarUrl = await ResolveAvatarUrlAsync(user.AvatarUrl);
        return dto;
    }

    public async Task<UserListItemDto> CreateAsync(long companyId, UserCreateDto dto)
    {
        var email = (dto.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw Bad("Email không hợp lệ.");
        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
            throw Bad("Mật khẩu phải từ 6 ký tự.");
        ValidateRole(dto.Role);
        // Email là định danh đăng nhập duy nhất toàn hệ thống (V028) -> không nêu email đó đang
        // thuộc công ty nào, vì người tạo tài khoản không có quyền biết dữ liệu tenant khác.
        if (await _userRepo.EmailExistsAsync(email))
            throw Conflict($"Email '{email}' đã được sử dụng cho một tài khoản khác.");

        var user = new UserEntity
        {
            Email = email,
            PasswordHash = _encode.SHA256WithSalt(dto.Password, PasswordSalt),
            Role = dto.Role,
            FullName = string.IsNullOrWhiteSpace(dto.FullName) ? null : dto.FullName.Trim(),
            Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
            Status = "Active"
        };
        user.UserId = await _userRepo.InsertAsync(companyId, user);
        return Map(user);
    }

    public async Task<UserListItemDto> UpdateAsync(long companyId, long userId, UserUpdateDto dto)
    {
        ValidateRole(dto.Role);
        var status = (dto.Status ?? "Active").Trim();
        if (status != "Active" && status != "Disabled")
            throw Bad("Status chỉ nhận Active | Disabled.");

        var existing = await _userRepo.GetByIdAsync(companyId, userId)
            ?? throw NotFound($"Không tìm thấy tài khoản (user_id={userId}).");

        var fullName = string.IsNullOrWhiteSpace(dto.FullName) ? null : dto.FullName.Trim();
        var phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
        await _userRepo.UpdateAsync(companyId, userId, fullName, phone, dto.Role, status);

        existing.FullName = fullName;
        existing.Phone = phone;
        existing.Role = dto.Role;
        existing.Status = status;
        return Map(existing);
    }

    public async Task<UserListItemDto> UpdateOwnProfileAsync(long companyId, long userId, ProfileUpdateDto dto)
    {
        var existing = await _userRepo.GetByIdAsync(companyId, userId)
            ?? throw NotFound($"Không tìm thấy tài khoản (user_id={userId}).");

        // Họ tên để trống được: cột full_name NULL, còn Create/Update của Admin cũng cho null —
        // chặn riêng ở đây thì người dùng không xoá nổi cái tên mà chính Admin đã tạo trống.
        // Chỗ hiển thị đã tự rơi về email khi tên rỗng.
        var fullName = string.IsNullOrWhiteSpace(dto.FullName) ? null : dto.FullName.Trim();

        var phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
        if (phone is not null && !IsValidPhone(phone))
            throw Bad("Số điện thoại phải đúng 10 chữ số và bắt đầu bằng 0.");

        // Giữ NGUYÊN Role/Status đang có: người dùng tự sửa hồ sơ không được đổi quyền của mình,
        // cũng không được tự gỡ trạng thái Disabled do Admin đặt.
        await _userRepo.UpdateAsync(companyId, userId, fullName, phone, existing.Role, existing.Status);

        existing.FullName = fullName;
        existing.Phone = phone;
        var result = Map(existing);
        result.AvatarUrl = await ResolveAvatarUrlAsync(existing.AvatarUrl);
        return result;
    }

    public async Task<string?> UpdateOwnAvatarAsync(
        long companyId, long userId, string fileName, string? contentType, byte[] content)
    {
        if (content is null || content.Length == 0)
            throw Bad("Chưa chọn file ảnh.");
        if (content.Length > MaxAvatarBytes)
            throw Bad($"Ảnh tối đa {MaxAvatarBytes / (1024 * 1024)}MB.");

        var ext = Path.GetExtension(fileName ?? "");
        if (!AllowedAvatarExtensions.Contains(ext))
            throw Bad("Ảnh phải có đuôi .jpg, .jpeg, .png hoặc .webp.");

        // Đuôi file do client đặt nên bịa được -> soi thêm content type VÀ magic bytes.
        var mime = string.IsNullOrWhiteSpace(contentType) ? GuessContentType(ext) : contentType.Trim();
        if (!AllowedAvatarContentTypes.Contains(mime))
            throw Bad("File tải lên không phải ảnh JPG/PNG/WEBP.");
        if (!LooksLikeImage(content))
            throw Bad("Nội dung file không phải ảnh hợp lệ (JPG/PNG/WEBP).");

        _ = await _userRepo.GetByIdAsync(companyId, userId)
            ?? throw NotFound($"Không tìm thấy tài khoản (user_id={userId}).");

        // Key có companyId + userId để dễ soi/dọn theo tenant; GUID tránh đè ảnh cũ và
        // tránh trình duyệt cache nhầm ảnh cũ sau khi đổi.
        var objectKey = $"avatar/{companyId}/{userId}/{Guid.NewGuid():N}{ext.ToLowerInvariant()}";

        // Khác CV (lưu file lỗi vẫn chấm điểm tiếp): ở đây file CHÍNH LÀ kết quả người dùng
        // muốn, lưu hỏng mà báo thành công thì họ thấy ảnh không đổi và không hiểu vì sao.
        try
        {
            using var ms = new MemoryStream(content);
            await _fileStorage.UploadAsync(objectKey, ms, content.Length, mime);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "UpdateOwnAvatar: đẩy ảnh đại diện lên storage thất bại (user_id={UserId}).", userId);
            throw new BaseException("Upload avatar failed")
            {
                ErrorCode = "STORAGE_UNAVAILABLE",
                ErrorMessage = "Không lưu được ảnh lên kho file. Vui lòng thử lại.",
                HttpStatus = (int)HttpStatusCode.ServiceUnavailable
            };
        }

        await _userRepo.UpdateAvatarAsync(companyId, userId, objectKey);
        return await ResolveAvatarUrlAsync(objectKey);
    }

    public async Task RemoveOwnAvatarAsync(long companyId, long userId)
    {
        _ = await _userRepo.GetByIdAsync(companyId, userId)
            ?? throw NotFound($"Không tìm thấy tài khoản (user_id={userId}).");
        await _userRepo.UpdateAvatarAsync(companyId, userId, null);
    }

    public async Task ResetPasswordAsync(long companyId, long userId, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
            throw Bad("Mật khẩu phải từ 6 ký tự.");
        _ = await _userRepo.GetByIdAsync(companyId, userId)
            ?? throw NotFound($"Không tìm thấy tài khoản (user_id={userId}).");

        await _userRepo.UpdatePasswordAsync(companyId, userId, _encode.SHA256WithSalt(newPassword, PasswordSalt));
    }

    public async Task DisableAsync(long companyId, long userId)
    {
        var user = await _userRepo.GetByIdAsync(companyId, userId)
            ?? throw NotFound($"Không tìm thấy tài khoản (user_id={userId}).");
        // Soft disable — giữ user row cho audit + lịch sử chấm phỏng vấn.
        await _userRepo.UpdateAsync(companyId, userId, user.FullName, user.Phone, user.Role, "Disabled");
    }

    public async Task<IReadOnlyList<UserOptionDto>> GetOptionsAsync(long companyId, string? role)
    {
        if (!string.IsNullOrWhiteSpace(role))
            ValidateRole(role);

        var active = (await _userRepo.GetListByCompanyAsync(companyId))
            .Where(u => u.Status == "Active")
            .ToList();

        if (!string.IsNullOrWhiteSpace(role))
        {
            var matching = active
                .Where(u => string.Equals(u.Role, role, StringComparison.OrdinalIgnoreCase))
                .ToList();

            // Công ty đã có người ĐÚNG role -> chỉ trả những người đó. Trước đây Admin luôn bị
            // nhét vào mọi bộ lọc, nên dropdown "chọn interviewer" hiện cả tài khoản Admin và
            // dễ chọn nhầm (panel khung phỏng vấn gán trúng Admin thay vì Interviewer thật).
            //
            // Chỉ khi KHÔNG có ai mang role đó mới rơi về Admin — giữ đường của công ty 1 người
            // chạy bằng đúng 1 tài khoản Admin (superuser), nếu không dropdown sẽ trống trơn và
            // họ không đặt được lịch phỏng vấn.
            active = matching.Count > 0
                ? matching
                : active.Where(u => string.Equals(u.Role, RoleConstants.Admin, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return active
            .Select(u => new UserOptionDto
            {
                UserId = u.UserId,
                Email = u.Email,
                FullName = u.FullName,
                Role = u.Role
            })
            .ToList();
    }

    // ============================================================

    /// <summary>
    /// Object key -> URL xem được (presigned ~1h). Storage hỏng thì trả null chứ KHÔNG ném:
    /// thiếu ảnh đại diện không đáng làm hỏng cả màn hồ sơ (FE rơi về avatar chữ cái đầu).
    /// </summary>
    private async Task<string?> ResolveAvatarUrlAsync(string? objectKey)
    {
        if (string.IsNullOrWhiteSpace(objectKey)) return null;
        try
        {
            return await _fileStorage.GetPresignedUrlAsync(objectKey);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "Không tạo được URL ảnh đại diện cho object '{ObjectKey}'.", objectKey);
            return null;
        }
    }

    private static string GuessContentType(string ext) => ext.ToLowerInvariant() switch
    {
        ".png" => "image/png",
        ".webp" => "image/webp",
        _ => "image/jpeg"
    };

    /// <summary>
    /// Soi magic bytes đầu file: chặn trường hợp đổi tên .exe thành .jpg rồi khai content type ảnh.
    /// JPEG FF D8 FF · PNG 89 50 4E 47 · WEBP "RIFF"...."WEBP".
    /// </summary>
    private static bool LooksLikeImage(byte[] bytes)
    {
        if (bytes.Length < 12) return false;

        if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF) return true;
        if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) return true;
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F' &&
            bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') return true;

        return false;
    }

    /// <summary>SĐT Việt Nam rút gọn: đúng 10 chữ số, bắt đầu bằng 0 (khớp rule đang validate ở FE).</summary>
    private static bool IsValidPhone(string phone) =>
        phone.Length == 10 && phone[0] == '0' && phone.All(char.IsAsciiDigit);

    private static void ValidateRole(string? role)
    {
        if (string.IsNullOrWhiteSpace(role) || !RoleConstants.All.Contains(role))
            throw Bad($"Role không hợp lệ. Hợp lệ: {string.Join(", ", RoleConstants.All)}.");
    }

    private static UserListItemDto Map(UserEntity u) => new()
    {
        UserId = u.UserId,
        Email = u.Email,
        FullName = u.FullName,
        Phone = u.Phone,
        Role = u.Role,
        Status = u.Status,
        LastLoginAt = u.LastLoginAt,
        CreatedAt = u.CreatedAt
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
