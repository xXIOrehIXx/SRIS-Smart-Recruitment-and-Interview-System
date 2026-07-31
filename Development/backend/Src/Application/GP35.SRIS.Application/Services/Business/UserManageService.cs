using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.User;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services;
using Microsoft.Extensions.DependencyInjection;
using UserEntity = GP35.SRIS.Domain.Entities.User;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>Admin quản lý tài khoản nội bộ (docs 2). Mật khẩu hash SHA256WithSalt như luồng login.</summary>
public class UserManageService : BaseService<UserManageService>, IUserManageService
{
    // Cùng salt cố định với AuthService.LoginAsync — đổi thì cả 2 chỗ phải đổi.
    private const string PasswordSalt = "salt";

    private readonly IUserRepo _userRepo;
    private readonly IEncodeService _encode;

    public UserManageService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _userRepo = serviceProvider.GetRequiredService<IUserRepo>();
        _encode = serviceProvider.GetRequiredService<IEncodeService>();
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
        return Map(user);
    }

    public async Task<UserListItemDto> CreateAsync(long companyId, UserCreateDto dto)
    {
        var email = (dto.Email ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw Bad("Email không hợp lệ.");
        if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 6)
            throw Bad("Mật khẩu phải từ 6 ký tự.");
        ValidateRole(dto.Role);
        if (await _userRepo.EmailExistsAsync(companyId, email))
            throw Conflict($"Email '{email}' đã tồn tại trong công ty.");

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
