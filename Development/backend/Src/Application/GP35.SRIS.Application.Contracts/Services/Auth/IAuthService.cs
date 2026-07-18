using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts.Dtos.Auth;
namespace GP35.SRIS.Application.Contracts;

public interface IAuthService : IBaseService
{
  Task<LoginResult> LoginAsync(string username, string password);

  /// <summary>Đăng ký công ty mới + Admin đầu tiên -> tự đăng nhập (trả token).</summary>
  Task<LoginResult> RegisterCompanyAsync(RegisterCompanyRequest req);

  /// <summary>
  /// Quên mật khẩu: sinh token đặt lại + gửi email (best-effort). KHÔNG lộ email có tồn tại hay không
  /// (chống dò tài khoản) — luôn trả thành công.
  /// </summary>
  Task ForgotPasswordAsync(string email);

  /// <summary>Đặt lại mật khẩu từ token email (đốt token sau khi dùng).</summary>
  Task ResetPasswordAsync(string token, string newPassword);

  /// <summary>Làm mới access token từ refresh token (xoay vòng: đốt refresh cũ, phát cặp mới).</summary>
  Task<LoginResult> RefreshAsync(string refreshToken);

  /// <summary>Người đang đăng nhập tự đổi mật khẩu (xác thực mật khẩu cũ, thu hồi refresh token cũ).</summary>
  Task ChangePasswordAsync(long userId, string oldPassword, string newPassword);
}
