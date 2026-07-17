namespace GP35.SRIS.Application.Contracts.Dtos.Business.User;

/// <summary>1 tài khoản nội bộ hiển thị cho Admin (không lộ password_hash).</summary>
public class UserListItemDto
{
    public long UserId { get; set; }
    public string Email { get; set; } = null!;
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string Role { get; set; } = null!;
    public string Status { get; set; } = null!;
    public DateTime? LastLoginAt { get; set; }
    public DateTime? CreatedAt { get; set; }
}

/// <summary>Admin tạo tài khoản nội bộ mới (Recruiter/Interviewer/DepartmentManager/Admin).</summary>
public class UserCreateDto
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string Role { get; set; } = null!;
}

/// <summary>Admin sửa tài khoản (đổi role/khóa tài khoản; KHÔNG đổi email).</summary>
public class UserUpdateDto
{
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string Role { get; set; } = null!;
    /// <summary>Active | Disabled.</summary>
    public string Status { get; set; } = "Active";
}

/// <summary>Đổi mật khẩu 1 tài khoản (Admin reset).</summary>
public class UserPasswordDto
{
    public string NewPassword { get; set; } = null!;
}

/// <summary>
/// Item gọn cho dropdown chọn người (gán interviewer vào khung, chọn DM cho job) —
/// Recruiter/DM gọi được, không lộ Status/LastLoginAt như bảng quản trị của Admin.
/// </summary>
public class UserOptionDto
{
    public long UserId { get; set; }
    public string Email { get; set; } = null!;
    public string? FullName { get; set; }
    public string Role { get; set; } = null!;
}
