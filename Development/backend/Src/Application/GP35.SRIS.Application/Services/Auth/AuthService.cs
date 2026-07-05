using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts.Dtos.Auth;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Domain.Shared.Security;
using GP35.SRIS.Lib.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application;

/// <summary>
/// Xác thực User nội bộ (Portal): login, đăng ký công ty, quên/đặt lại mật khẩu, refresh token.
/// Mật khẩu hash SHA256WithSalt(salt) — cùng cơ chế với UserManageService. Token refresh/reset lưu HASH.
/// </summary>
public class AuthService : BaseService<AuthService>, IAuthService
{
    private const string PasswordSalt = "salt";
    private static readonly TimeSpan RefreshTtl = TimeSpan.FromDays(7);
    private static readonly TimeSpan ResetTtl = TimeSpan.FromHours(1);

    private readonly IUserRepo _userRepo;
    private readonly ICompanyRepo _companyRepo;
    private readonly IUserAuthTokenRepo _tokenRepo;
    private readonly IEncodeService _encode;
    private readonly IJwtService _jwt;
    private readonly IEmailService _email;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public AuthService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _userRepo = serviceProvider.GetRequiredService<IUserRepo>();
        _companyRepo = serviceProvider.GetRequiredService<ICompanyRepo>();
        _tokenRepo = serviceProvider.GetRequiredService<IUserAuthTokenRepo>();
        _encode = serviceProvider.GetRequiredService<IEncodeService>();
        _jwt = serviceProvider.GetRequiredService<IJwtService>();
        _email = serviceProvider.GetRequiredService<IEmailService>();
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<AuthService>();
    }

    public async Task<LoginResult> LoginAsync(string email, string password)
    {
        email = (email ?? "").Trim().ToLowerInvariant();
        var user = await _userRepo.GetByEmail(email);
        if (user is null)
            throw AuthError(AuthErrorCode.UsernameOrPwdInvalid, AuthErrorMessage.UsernameOrPwdInvalid);

        if (_encode.SHA256WithSalt(password ?? "", PasswordSalt) != user.PasswordHash)
            throw AuthError(AuthErrorCode.UsernameOrPwdInvalid, AuthErrorMessage.UsernameOrPwdInvalid);

        if (string.Equals(user.Status, "Disabled", StringComparison.OrdinalIgnoreCase))
            throw AuthError(AuthErrorCode.UserInactive, AuthErrorMessage.UserInactive);

        await _userRepo.TouchLastLoginAsync(user.UserId);
        return await IssueTokensAsync(user);
    }

    public async Task<LoginResult> RegisterCompanyAsync(RegisterCompanyRequest req)
    {
        var companyName = (req.CompanyName ?? "").Trim();
        if (string.IsNullOrWhiteSpace(companyName))
            throw Bad("Tên công ty không được để trống.");

        var email = (req.AdminEmail ?? "").Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
            throw Bad("Email quản trị không hợp lệ.");
        if (string.IsNullOrWhiteSpace(req.AdminPassword) || req.AdminPassword.Length < 6)
            throw Bad("Mật khẩu phải từ 6 ký tự.");

        // Slug: từ input hoặc tự sinh từ tên công ty; đảm bảo duy nhất (thêm hậu tố nếu trùng).
        var slug = Slugify(string.IsNullOrWhiteSpace(req.Slug) ? companyName : req.Slug!);
        if (string.IsNullOrWhiteSpace(slug)) slug = "company";
        slug = await EnsureUniqueSlugAsync(slug);

        var companyId = await _companyRepo.InsertAsync(new Company
        {
            Name = companyName,
            Slug = slug
        });

        var admin = new User
        {
            Email = email,
            PasswordHash = _encode.SHA256WithSalt(req.AdminPassword, PasswordSalt),
            Role = RoleConstants.Admin,
            FullName = string.IsNullOrWhiteSpace(req.AdminFullName) ? null : req.AdminFullName!.Trim(),
            Status = "Active"
        };
        admin.UserId = await _userRepo.InsertForNewCompanyAsync(companyId, admin);
        admin.CompanyId = companyId;

        _logger.Information("Register: công ty mới id={CompanyId} slug={Slug}, Admin={Email}.",
            companyId, slug, email);

        return await IssueTokensAsync(admin);
    }

    public async Task ForgotPasswordAsync(string email)
    {
        email = (email ?? "").Trim().ToLowerInvariant();
        var user = await _userRepo.GetByEmail(email);

        // Chống dò tài khoản: KHÔNG lộ email có tồn tại hay không — luôn trả thành công.
        if (user is null)
        {
            _logger.Information("ForgotPassword: email {Email} không có tài khoản — bỏ qua (không lộ).", email);
            return;
        }

        var raw = GenerateRawToken();
        await _tokenRepo.InsertAsync(new UserAuthToken
        {
            CompanyId = user.CompanyId,
            UserId = user.UserId,
            TokenHash = MagicLinkTokenCodec.Hash(raw),
            Purpose = "PASSWORD_RESET",
            ExpiresAt = DateTime.UtcNow.Add(ResetTtl)
        });

        // Gửi email best-effort (không có SMTP -> no-op, không làm rớt request).
        try
        {
            var baseUrl = (_config.CandidatePortal?.BaseUrl ?? "http://localhost:3000").TrimEnd('/');
            var link = $"{baseUrl}/reset-password?token={Uri.EscapeDataString(raw)}";
            var body = $@"<p>Xin chào,</p>
<p>Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu tài khoản SRIS. Nhấn liên kết dưới đây để đặt mật khẩu mới
(hiệu lực trong 1 giờ):</p>
<p><a href=""{link}"">{link}</a></p>
<p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>";
            await _email.SendEmailAsync("Đặt lại mật khẩu SRIS", body, user.Email, string.Empty);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "ForgotPassword: gửi email thất bại (user={UserId}) — bỏ qua (best-effort).",
                user.UserId);
        }
    }

    public async Task ResetPasswordAsync(string token, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
            throw Bad("Mật khẩu phải từ 6 ký tự.");

        var row = await _tokenRepo.GetByHashAsync(MagicLinkTokenCodec.Hash(token ?? ""), "PASSWORD_RESET");
        if (row is null || row.UsedAt is not null || row.ExpiresAt <= DateTime.UtcNow)
            throw AuthError(AuthErrorCode.ExpiredForgotPassword, AuthErrorMessage.SessionExpiredResetPassword);

        await _userRepo.UpdatePasswordCrossTenantAsync(row.UserId,
            _encode.SHA256WithSalt(newPassword, PasswordSalt));
        await _tokenRepo.MarkUsedAsync(row.TokenId);
        // Đổi mật khẩu -> thu hồi mọi refresh token cũ (đăng xuất các phiên khác).
        await _tokenRepo.RevokeActiveAsync(row.UserId, "REFRESH");

        _logger.Information("ResetPassword: user={UserId} đã đặt lại mật khẩu.", row.UserId);
    }

    public async Task<LoginResult> RefreshAsync(string refreshToken)
    {
        var row = await _tokenRepo.GetByHashAsync(MagicLinkTokenCodec.Hash(refreshToken ?? ""), "REFRESH");
        if (row is null || row.UsedAt is not null || row.ExpiresAt <= DateTime.UtcNow)
            throw AuthError(AuthErrorCode.SessionExpired, AuthErrorMessage.SessionExpired);

        var user = await _userRepo.GetByIdCrossTenantAsync(row.UserId);
        if (user is null || string.Equals(user.Status, "Disabled", StringComparison.OrdinalIgnoreCase))
            throw AuthError(AuthErrorCode.UserInactive, AuthErrorMessage.UserInactive);

        // Xoay vòng: đốt refresh cũ, phát cặp mới.
        await _tokenRepo.MarkUsedAsync(row.TokenId);
        return await IssueTokensAsync(user);
    }

    // ============================================================

    /// <summary>Sinh cặp JWT + lưu HASH refresh token (để RefreshAsync xác thực sau).</summary>
    private async Task<LoginResult> IssueTokensAsync(User user)
    {
        var roles = string.IsNullOrWhiteSpace(user.Role) ? new List<string>() : new List<string> { user.Role };
        var (accessToken, refreshToken) = _jwt.GenerateTokens(
            user.UserId, user.Email, roles, user.CompanyId.ToString(),
            user.Email, user.Phone, user.FullName, user.UserId.ToString());

        await _tokenRepo.InsertAsync(new UserAuthToken
        {
            CompanyId = user.CompanyId,
            UserId = user.UserId,
            TokenHash = MagicLinkTokenCodec.Hash(refreshToken),
            Purpose = "REFRESH",
            ExpiresAt = DateTime.UtcNow.Add(RefreshTtl)
        });

        return new LoginResult
        {
            CompanyId = user.CompanyId.ToString(),
            AccessToken = accessToken,
            RefreshToken = refreshToken
        };
    }

    private async Task<string> EnsureUniqueSlugAsync(string baseSlug)
    {
        var slug = baseSlug;
        var n = 1;
        while (await _companyRepo.GetBySlugAsync(slug) is not null)
            slug = $"{baseSlug}-{++n}";
        return slug;
    }

    private static string GenerateRawToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    /// <summary>Chuẩn hóa chuỗi thành slug URL: bỏ dấu, thường hóa, ký tự lạ -> '-', gộp '-' thừa.</summary>
    private static string Slugify(string input)
    {
        var decomposed = input.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        var ascii = sb.ToString().Normalize(NormalizationForm.FormC)
            .Replace('đ', 'd').Replace('Đ', 'D').ToLowerInvariant();

        var slug = new string(ascii.Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray());
        while (slug.Contains("--")) slug = slug.Replace("--", "-");
        return slug.Trim('-');
    }

    private static AuthException AuthError(string code, string message) => new()
    {
        ErrorCode = code, ErrorMessage = message, HttpStatus = StatusCodes.Status401Unauthorized
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };
}
