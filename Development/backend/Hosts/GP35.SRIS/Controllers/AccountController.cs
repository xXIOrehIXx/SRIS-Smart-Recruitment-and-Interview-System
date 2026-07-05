using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts.Dtos.Auth;
using GP35.SRIS.Lib.Services;
using Microsoft.AspNetCore.Authorization;

namespace GP35.SRIS
{
  [Route("api/[controller]")]
  [ApiController]
  public class AccountController : ControllerBase
  {
    private readonly IAuthService _authService;
    public AccountController(IAuthService authService)
    {
      _authService = authService;
    }

    [AllowAnonymous]
    [HttpPost("Login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
      var result = await _authService.LoginAsync(request.Email, request.Password);
      return Ok(result);
    }

    /// <summary>Đăng ký công ty mới + tài khoản Admin đầu tiên (self-signup SaaS) -> tự đăng nhập.</summary>
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterCompanyRequest request)
    {
      var result = await _authService.RegisterCompanyAsync(request);
      return Ok(result);
    }

    /// <summary>Quên mật khẩu — gửi link đặt lại (luôn trả 200, không lộ email có tồn tại hay không).</summary>
    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
      await _authService.ForgotPasswordAsync(request.Email);
      return Ok(new { message = "Nếu email tồn tại, chúng tôi đã gửi liên kết đặt lại mật khẩu." });
    }

    /// <summary>Đặt lại mật khẩu từ token nhận qua email.</summary>
    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
      await _authService.ResetPasswordAsync(request.Token, request.NewPassword);
      return Ok(new { message = "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại." });
    }

    /// <summary>Làm mới access token từ refresh token (xoay vòng token).</summary>
    [AllowAnonymous]
    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
      var result = await _authService.RefreshAsync(request.RefreshToken);
      return Ok(result);
    }

    /// <summary>Đăng xuất — JWT stateless nên client chỉ cần xóa token; endpoint để FE gọi thống nhất.</summary>
    [Authorize]
    [HttpPost("logout")]
    public IActionResult Logout() => Ok(new { message = "Đã đăng xuất." });

    [AllowAnonymous]
    [HttpPost("ComputeHash")]
    public IActionResult ComputeHash([FromBody] HashRequest request)
    {
      var encodeService = HttpContext.RequestServices.GetRequiredService<IEncodeService>();
      var hash = encodeService.SHA256WithSalt(request.Password, "salt");
      return Ok(new { hash });
    }
  }

  public class HashRequest
  {
    public string Password { get; set; }
  }
}