using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GP35.SRIS.Domain.Shared.Constants
{
    public class AuthErrorCode
    {
        public const string UsernameOrPwdInvalid = "Auth:001";
        public const string UserInactive = "Auth:002";
        public const string UserBlocked = "Auth:003";
        public const string UserNotLoggedIn = "Auth:004";
        public const string SessionExpired = "Auth:005";

        public const string CaptchaInvalid = "Auth:006";
        public const string PasswordInvalidRule = "Auth:007";
        public const string EmailDoesntHaveAccount = "Auth:008";
        public const string ExpiredForgotPassword = "Auth:009";
        public const string Forbidden = "Auth:010";
    }

    public class AuthErrorMessage
    {
        public const string UsernameOrPwdInvalid = "Tài khoản hoặc mật khẩu không chính xác";
        public const string UserInactive = "Tài khoản người dùng đã dừng hoạt động";
        public const string UserBlocked = "Tài khoản đã ngừng kích hoạt";
        public const string UserNotLoggedIn = "Người dùng chưa đăng nhập";
        public const string SessionExpired = "Phiên đăng nhập đã hết hạn";
        public const string PasswordInvalid = "Mật khẩu không chính xác";
        public const string PasswordInvalidRule = "Mật khẩu không đúng định dạng";
        public const string CaptchaInvalid = "Sai quá số lần, vui lòng điền captcha hợp lệ";
        // Chỉ dùng cho luồng đặt lại mật khẩu qua email: token sai / hết hạn / đã dùng.
        // Nói rõ "liên kết" chứ không phải "phiên làm việc" — người dùng vào từ link email,
        // không có phiên đăng nhập nào để mà hết hạn.
        public const string SessionExpiredResetPassword =
            "Liên kết đặt lại mật khẩu đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.";
        public const string Forbidden = "Bạn không có quyền thực hiện thao tác này";
    }
}
