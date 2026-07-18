namespace GP35.SRIS.Application.Contracts.Dtos.Auth;

/// <summary>
/// Đăng ký công ty mới (self-signup SaaS): tạo Company + tài khoản Admin đầu tiên,
/// tự đăng nhập luôn (trả token). Slug = URL công khai Career Site (/t/{slug}).
/// </summary>
public class RegisterCompanyRequest
{
    public string CompanyName { get; set; } = null!;
    /// <summary>Slug URL công khai (chỉ a-z 0-9 gạch nối). Trống -> tự sinh từ CompanyName.</summary>
    public string? Slug { get; set; }
    public string AdminEmail { get; set; } = null!;
    public string AdminPassword { get; set; } = null!;
    public string? AdminFullName { get; set; }
}

/// <summary>Quên mật khẩu — nhập email; hệ thống gửi link đặt lại (best-effort).</summary>
public class ForgotPasswordRequest
{
    public string Email { get; set; } = null!;
}

/// <summary>Đặt lại mật khẩu từ token nhận qua email.</summary>
public class ResetPasswordRequest
{
    public string Token { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
}

/// <summary>Làm mới access token từ refresh token.</summary>
public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = null!;
}

/// <summary>Người đang đăng nhập tự đổi mật khẩu (phải nhập đúng mật khẩu cũ).</summary>
public class ChangePasswordRequest
{
    public string OldPassword { get; set; } = null!;
    public string NewPassword { get; set; } = null!;
}
