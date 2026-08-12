using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos.Auth;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Domain.Shared.Security;
using GP35.SRIS.Lib.Services;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// AuthService: login (sai email/mật khẩu/bị khóa đều 401, không lộ lý do),
/// đổi mật khẩu tự phục vụ (xác thực mật khẩu cũ + thu hồi refresh token cũ).
/// Hash mật khẩu được mock tất định: SHA256WithSalt(x, salt) = "H:" + x.
/// </summary>
public class AuthServiceTests
{
    private readonly Mock<IUserRepo> _userRepo = new();
    private readonly Mock<ICompanyRepo> _companyRepo = new();
    private readonly Mock<IUserAuthTokenRepo> _tokenRepo = new();
    private readonly Mock<IEncodeService> _encode = new();
    private readonly Mock<IJwtService> _jwt = new();
    private readonly Mock<IEmailService> _email = new();
    private readonly Mock<IEmailTemplateService> _emailTemplateService = new();

    private static User MakeUser(string status = "Active") => new()
    {
        UserId = 13,
        CompanyId = 6,
        Email = "user@example.com",
        PasswordHash = "H:matkhau-dung",
        Role = "Admin",
        FullName = "Test User",
        Status = status
    };

    private GP35.SRIS.Application.AuthService CreateService()
    {
        _encode.Setup(e => e.SHA256WithSalt(It.IsAny<string>(), It.IsAny<string>()))
            .Returns<string, string>((input, _) => "H:" + input);
        _jwt.Setup(j => j.GenerateTokens(
                It.IsAny<long>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(),
                It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<string?>(),
                It.IsAny<string?>(), It.IsAny<string?>()))
            .Returns(("access-token", "refresh-token"));
        _tokenRepo.Setup(r => r.InsertAsync(It.IsAny<UserAuthToken>())).ReturnsAsync(1L);

        _emailTemplateService.Setup(s => s.EnsureDefaultsAsync(It.IsAny<long>())).ReturnsAsync(5);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_userRepo.Object);
            s.AddSingleton(_companyRepo.Object);
            s.AddSingleton(_tokenRepo.Object);
            s.AddSingleton(_encode.Object);
            s.AddSingleton(_jwt.Object);
            s.AddSingleton(_email.Object);
            s.AddSingleton(_emailTemplateService.Object);
        });
        return new GP35.SRIS.Application.AuthService(provider);
    }

    // ===== Login =====

    [Fact]
    public async Task Login_UnknownEmail_Throws401()
    {
        _userRepo.Setup(r => r.GetByEmail(It.IsAny<string>())).ReturnsAsync((User?)null!);
        var service = CreateService();

        await Assert.ThrowsAsync<AuthException>(
            () => service.LoginAsync("khongtontai@example.com", "x"));
    }

    [Fact]
    public async Task Login_WrongPassword_Throws401()
    {
        _userRepo.Setup(r => r.GetByEmail("user@example.com")).ReturnsAsync(MakeUser());
        var service = CreateService();

        await Assert.ThrowsAsync<AuthException>(
            () => service.LoginAsync("user@example.com", "matkhau-sai"));
    }

    [Fact]
    public async Task Login_DisabledUser_Throws401()
    {
        _userRepo.Setup(r => r.GetByEmail("user@example.com")).ReturnsAsync(MakeUser("Disabled"));
        var service = CreateService();

        await Assert.ThrowsAsync<AuthException>(
            () => service.LoginAsync("user@example.com", "matkhau-dung"));
    }

    [Fact]
    public async Task Login_Success_ReturnsTokens_AndStoresRefreshHash()
    {
        _userRepo.Setup(r => r.GetByEmail("user@example.com")).ReturnsAsync(MakeUser());
        var service = CreateService();

        // Setup callback SAU CreateService — CreateService đã Setup InsertAsync, setup sau ghi đè
        UserAuthToken? storedToken = null;
        _tokenRepo.Setup(r => r.InsertAsync(It.IsAny<UserAuthToken>()))
            .Callback<UserAuthToken>(t => storedToken = t)
            .ReturnsAsync(1L);
        var result = await service.LoginAsync("user@example.com", "matkhau-dung");

        Assert.Equal("access-token", result.AccessToken);
        Assert.Equal("refresh-token", result.RefreshToken);
        Assert.NotNull(storedToken);
        Assert.Equal("REFRESH", storedToken!.Purpose);
        Assert.NotEqual("refresh-token", storedToken.TokenHash); // lưu HASH, không lưu gốc
        _userRepo.Verify(r => r.TouchLastLoginAsync(13), Times.Once);
    }

    [Fact]
    public async Task Login_EmailIsNormalized_TrimAndLowercase()
    {
        _userRepo.Setup(r => r.GetByEmail("user@example.com")).ReturnsAsync(MakeUser());
        var service = CreateService();

        var result = await service.LoginAsync("  USER@Example.Com  ", "matkhau-dung");

        Assert.NotNull(result.AccessToken);
        _userRepo.Verify(r => r.GetByEmail("user@example.com"), Times.Once);
    }

    // ===== ChangePassword (self-service) =====

    [Fact]
    public async Task ChangePassword_TooShort_Throws400()
    {
        var service = CreateService();
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.ChangePasswordAsync(13, "matkhau-dung", "12345"));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task ChangePassword_WrongOldPassword_Throws400_AndDoesNotUpdate()
    {
        _userRepo.Setup(r => r.GetByIdCrossTenantAsync(13)).ReturnsAsync(MakeUser());
        var service = CreateService();

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.ChangePasswordAsync(13, "sai-bet", "matkhau-moi-123"));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
        _userRepo.Verify(r => r.UpdatePasswordCrossTenantAsync(It.IsAny<long>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ChangePassword_DisabledUser_Throws401()
    {
        _userRepo.Setup(r => r.GetByIdCrossTenantAsync(13)).ReturnsAsync(MakeUser("Disabled"));
        var service = CreateService();

        await Assert.ThrowsAsync<AuthException>(
            () => service.ChangePasswordAsync(13, "matkhau-dung", "matkhau-moi-123"));
    }

    [Fact]
    public async Task ChangePassword_Success_UpdatesHash_AndRevokesRefreshTokens()
    {
        _userRepo.Setup(r => r.GetByIdCrossTenantAsync(13)).ReturnsAsync(MakeUser());
        var service = CreateService();

        await service.ChangePasswordAsync(13, "matkhau-dung", "matkhau-moi-123");

        _userRepo.Verify(r => r.UpdatePasswordCrossTenantAsync(13, "H:matkhau-moi-123"), Times.Once);
        _tokenRepo.Verify(r => r.RevokeActiveAsync(13, "REFRESH"), Times.Once); // đăng xuất phiên khác
    }

    [Fact]
    public async Task ChangePassword_PasswordExactlySixChars_Succeeds()
    {
        // UTCID05: New password length exactly 6 characters (boundary value) registers successfully
        _userRepo.Setup(r => r.GetByIdCrossTenantAsync(13)).ReturnsAsync(MakeUser());
        var service = CreateService();

        await service.ChangePasswordAsync(13, "matkhau-dung", "123456");

        _userRepo.Verify(r => r.UpdatePasswordCrossTenantAsync(13, "H:123456"), Times.Once);
        _tokenRepo.Verify(r => r.RevokeActiveAsync(13, "REFRESH"), Times.Once);
    }

    // ===== RegisterCompany =====

    [Fact]
    public async Task RegisterCompany_Success_CreatesCompanyAndAdmin_AndIssuesTokens()
    {
        // UTCID01: Valid inputs, active state, returns LoginResult
        var service = CreateService();
        var req = new RegisterCompanyRequest
        {
            CompanyName = "Test Company",
            AdminEmail = "admin@testcompany.com",
            AdminPassword = "password123",
            AdminFullName = "Admin User"
        };

        _userRepo.Setup(r => r.EmailExistsAsync(It.IsAny<string>())).ReturnsAsync(false);
        _companyRepo.Setup(r => r.GetBySlugAsync(It.IsAny<string>())).ReturnsAsync((Company?)null);
        _companyRepo.Setup(r => r.InsertAsync(It.IsAny<Company>())).ReturnsAsync(1L);
        _userRepo.Setup(r => r.InsertForNewCompanyAsync(1L, It.IsAny<User>())).ReturnsAsync(2L);

        var result = await service.RegisterCompanyAsync(req);

        Assert.NotNull(result);
        Assert.Equal("1", result.CompanyId);
        Assert.Equal("access-token", result.AccessToken);
        Assert.Equal("refresh-token", result.RefreshToken);
        _companyRepo.Verify(r => r.InsertAsync(It.Is<Company>(c => c.Name == "Test Company")), Times.Once);
        _userRepo.Verify(r => r.InsertForNewCompanyAsync(1L, It.Is<User>(u => u.Email == "admin@testcompany.com")), Times.Once);
    }

    [Fact]
    public async Task RegisterCompany_EmptyCompanyName_Throws400()
    {
        // UTCID02: Null or empty company name throws BaseException with BAD_REQUEST
        var service = CreateService();
        var req = new RegisterCompanyRequest
        {
            CompanyName = "   ",
            AdminEmail = "admin@testcompany.com",
            AdminPassword = "password123"
        };

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.RegisterCompanyAsync(req));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task RegisterCompany_InvalidEmail_Throws400()
    {
        // UTCID03: Invalid email format or missing '@' throws BaseException with BAD_REQUEST
        var service = CreateService();
        var req = new RegisterCompanyRequest
        {
            CompanyName = "Test Company",
            AdminEmail = "invalid-email",
            AdminPassword = "password123"
        };

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.RegisterCompanyAsync(req));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task RegisterCompany_PasswordTooShort_Throws400()
    {
        // UTCID04: Password length < 6 characters throws BaseException with BAD_REQUEST
        var service = CreateService();
        var req = new RegisterCompanyRequest
        {
            CompanyName = "Test Company",
            AdminEmail = "admin@testcompany.com",
            AdminPassword = "12345"
        };

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.RegisterCompanyAsync(req));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task RegisterCompany_DuplicateSlug_AppendsSuffixAndSucceeds()
    {
        // UTCID05: Duplicate company slug automatically appends suffix (e.g. -2)
        var service = CreateService();
        var req = new RegisterCompanyRequest
        {
            CompanyName = "Test Company",
            AdminEmail = "admin@testcompany.com",
            AdminPassword = "password123",
            Slug = "test-company"
        };

        _userRepo.Setup(r => r.EmailExistsAsync(It.IsAny<string>())).ReturnsAsync(false);
        // First check: slug exists. Second check: slug-2 is free.
        _companyRepo.SetupSequence(r => r.GetBySlugAsync(It.IsAny<string>()))
            .ReturnsAsync(new Company { CompanyId = 10, Slug = "test-company" })
            .ReturnsAsync((Company?)null);
        _companyRepo.Setup(r => r.InsertAsync(It.IsAny<Company>())).ReturnsAsync(1L);
        _userRepo.Setup(r => r.InsertForNewCompanyAsync(1L, It.IsAny<User>())).ReturnsAsync(2L);

        var result = await service.RegisterCompanyAsync(req);

        Assert.NotNull(result);
        _companyRepo.Verify(r => r.InsertAsync(It.Is<Company>(c => c.Slug == "test-company-2")), Times.Once);
    }

    [Fact]
    public async Task RegisterCompany_PasswordExactlySixChars_Succeeds()
    {
        // UTCID06: Password length exactly 6 characters (boundary value) registers successfully
        var service = CreateService();
        var req = new RegisterCompanyRequest
        {
            CompanyName = "Test Company",
            AdminEmail = "admin@testcompany.com",
            AdminPassword = "123456"
        };

        _userRepo.Setup(r => r.EmailExistsAsync(It.IsAny<string>())).ReturnsAsync(false);
        _companyRepo.Setup(r => r.GetBySlugAsync(It.IsAny<string>())).ReturnsAsync((Company?)null);
        _companyRepo.Setup(r => r.InsertAsync(It.IsAny<Company>())).ReturnsAsync(1L);
        _userRepo.Setup(r => r.InsertForNewCompanyAsync(1L, It.IsAny<User>())).ReturnsAsync(2L);

        var result = await service.RegisterCompanyAsync(req);

        Assert.NotNull(result);
    }

    // ===== ForgotPassword =====

    [Fact]
    public async Task ForgotPassword_RegisteredUser_GeneratesTokenAndSendsEmail()
    {
        // UTCID01: Happy path, registered user, email sent successfully
        var service = CreateService();
        var email = "user@example.com";
        var user = MakeUser();

        _userRepo.Setup(r => r.GetByEmail(email)).ReturnsAsync((User?)user);
        _companyRepo.Setup(r => r.GetByCompanyId(user.CompanyId)).ReturnsAsync(new Company { Name = "Test Co" });
        
        UserAuthToken? storedToken = null;
        _tokenRepo.Setup(r => r.InsertAsync(It.IsAny<UserAuthToken>()))
            .Callback<UserAuthToken>(t => storedToken = t)
            .ReturnsAsync(1L);

        await service.ForgotPasswordAsync(email);

        Assert.NotNull(storedToken);
        Assert.Equal("PASSWORD_RESET", storedToken!.Purpose);
        Assert.Equal(user.UserId, storedToken.UserId);
        _email.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), email, It.IsAny<string>()), Times.Once);
    }

    [Fact]
    public async Task ForgotPassword_UnregisteredUser_DoesNothing_ButReturnsSuccess()
    {
        // UTCID02: User enumeration protection; unregistered emails return successfully without creating token or throwing
        var service = CreateService();
        var email = "notfound@example.com";

        _userRepo.Setup(r => r.GetByEmail(email)).ReturnsAsync((User?)null);

        await service.ForgotPasswordAsync(email);

        _tokenRepo.Verify(r => r.InsertAsync(It.IsAny<UserAuthToken>()), Times.Never);
        _email.Verify(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task ForgotPassword_SmtpFailure_LogsWarning_ButReturnsSuccess()
    {
        // UTCID03: "Best-effort" email sending; when SMTP service throws, method still returns successfully
        var service = CreateService();
        var email = "user@example.com";
        var user = MakeUser();

        _userRepo.Setup(r => r.GetByEmail(email)).ReturnsAsync((User?)user);
        _companyRepo.Setup(r => r.GetByCompanyId(user.CompanyId)).ReturnsAsync(new Company { Name = "Test Co" });
        _email.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .ThrowsAsync(new System.Exception("SMTP server down"));

        await service.ForgotPasswordAsync(email);

        // Token should still be saved even if email fails
        _tokenRepo.Verify(r => r.InsertAsync(It.IsAny<UserAuthToken>()), Times.Once);
    }

    // ===== ResetPassword =====

    [Fact]
    public async Task ResetPassword_Success_UpdatesPassword_MarksUsed_AndRevokesRefreshTokens()
    {
        // UTCID01: Happy path, valid token, unused, unexpired, valid new password length >= 6
        var service = CreateService();
        var token = "valid-reset-token";
        var tokenHash = MagicLinkTokenCodec.Hash(token);
        var tokenRow = new UserAuthToken
        {
            TokenId = 1L,
            UserId = 13L,
            CompanyId = 6L,
            Purpose = "PASSWORD_RESET",
            ExpiresAt = DateTime.UtcNow.AddMinutes(30)
        };

        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "PASSWORD_RESET")).ReturnsAsync(tokenRow);

        await service.ResetPasswordAsync(token, "newpassword123");

        _userRepo.Verify(r => r.UpdatePasswordCrossTenantAsync(13L, "H:newpassword123"), Times.Once);
        _tokenRepo.Verify(r => r.MarkUsedAsync(1L), Times.Once);
        _tokenRepo.Verify(r => r.RevokeActiveAsync(13L, "REFRESH"), Times.Once);
    }

    [Fact]
    public async Task ResetPassword_PasswordTooShort_Throws400()
    {
        // UTCID02: New password length < 6 characters throws BaseException with BAD_REQUEST
        var service = CreateService();
        var token = "valid-reset-token";

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.ResetPasswordAsync(token, "12345"));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task ResetPassword_TokenNotFoundOrUsed_Throws401()
    {
        // UTCID03: Null, non-existent, or used token throws AuthException (ExpiredForgotPassword)
        var service = CreateService();
        var token = "used-or-invalid-token";
        var tokenHash = MagicLinkTokenCodec.Hash(token);

        // Case 1: Not found
        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "PASSWORD_RESET")).ReturnsAsync((UserAuthToken?)null);
        await Assert.ThrowsAsync<AuthException>(() => service.ResetPasswordAsync(token, "newpassword123"));

        // Case 2: Already used
        var usedTokenRow = new UserAuthToken
        {
            TokenId = 1L,
            UserId = 13L,
            Purpose = "PASSWORD_RESET",
            UsedAt = DateTime.UtcNow
        };
        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "PASSWORD_RESET")).ReturnsAsync(usedTokenRow);
        await Assert.ThrowsAsync<AuthException>(() => service.ResetPasswordAsync(token, "newpassword123"));
    }

    [Fact]
    public async Task ResetPassword_ExpiredToken_Throws401()
    {
        // UTCID04: Expired token throws AuthException (ExpiredForgotPassword)
        var service = CreateService();
        var token = "expired-token";
        var tokenHash = MagicLinkTokenCodec.Hash(token);
        var expiredTokenRow = new UserAuthToken
        {
            TokenId = 1L,
            UserId = 13L,
            Purpose = "PASSWORD_RESET",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5)
        };

        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "PASSWORD_RESET")).ReturnsAsync(expiredTokenRow);

        await Assert.ThrowsAsync<AuthException>(() => service.ResetPasswordAsync(token, "newpassword123"));
    }

    [Fact]
    public async Task ResetPassword_PasswordExactlySixChars_Succeeds()
    {
        // UTCID05: New password length exactly 6 characters (boundary value) registers successfully
        var service = CreateService();
        var token = "valid-reset-token";
        var tokenHash = MagicLinkTokenCodec.Hash(token);
        var tokenRow = new UserAuthToken
        {
            TokenId = 1L,
            UserId = 13L,
            CompanyId = 6L,
            Purpose = "PASSWORD_RESET",
            ExpiresAt = DateTime.UtcNow.AddMinutes(30)
        };

        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "PASSWORD_RESET")).ReturnsAsync(tokenRow);

        await service.ResetPasswordAsync(token, "123456");

        _userRepo.Verify(r => r.UpdatePasswordCrossTenantAsync(13L, "H:123456"), Times.Once);
        _tokenRepo.Verify(r => r.MarkUsedAsync(1L), Times.Once);
    }

    // ===== Refresh =====

    [Fact]
    public async Task Refresh_Success_RotatesTokens_AndMarksUsed()
    {
        // UTCID01: Happy path, valid unused unexpired token, active user -> issues new tokens, marks old token as used
        var service = CreateService();
        var token = "valid-refresh-token";
        var tokenHash = MagicLinkTokenCodec.Hash(token);
        var tokenRow = new UserAuthToken
        {
            TokenId = 1L,
            UserId = 13L,
            CompanyId = 6L,
            Purpose = "REFRESH",
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };
        var user = MakeUser();

        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "REFRESH")).ReturnsAsync(tokenRow);
        _userRepo.Setup(r => r.GetByIdCrossTenantAsync(13L)).ReturnsAsync(user);

        var result = await service.RefreshAsync(token);

        Assert.NotNull(result);
        Assert.Equal("access-token", result.AccessToken);
        Assert.Equal("refresh-token", result.RefreshToken);
        _tokenRepo.Verify(r => r.MarkUsedAsync(1L), Times.Once);
    }

    [Fact]
    public async Task Refresh_TokenNotFound_Throws401()
    {
        // UTCID02: Token hash not found in DB throws AuthException (SessionExpired)
        var service = CreateService();
        var token = "invalid-refresh-token";
        var tokenHash = MagicLinkTokenCodec.Hash(token);

        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "REFRESH")).ReturnsAsync((UserAuthToken?)null);

        await Assert.ThrowsAsync<AuthException>(() => service.RefreshAsync(token));
    }

    [Fact]
    public async Task Refresh_AlreadyUsedToken_Throws401()
    {
        // UTCID03: Already used token throws AuthException (SessionExpired)
        var service = CreateService();
        var token = "used-refresh-token";
        var tokenHash = MagicLinkTokenCodec.Hash(token);
        var usedTokenRow = new UserAuthToken
        {
            TokenId = 1L,
            UserId = 13L,
            Purpose = "REFRESH",
            UsedAt = DateTime.UtcNow
        };

        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "REFRESH")).ReturnsAsync(usedTokenRow);

        await Assert.ThrowsAsync<AuthException>(() => service.RefreshAsync(token));
    }

    [Fact]
    public async Task Refresh_ExpiredToken_Throws401()
    {
        // UTCID04: Expired token throws AuthException (SessionExpired)
        var service = CreateService();
        var token = "expired-refresh-token";
        var tokenHash = MagicLinkTokenCodec.Hash(token);
        var expiredTokenRow = new UserAuthToken
        {
            TokenId = 1L,
            UserId = 13L,
            Purpose = "REFRESH",
            ExpiresAt = DateTime.UtcNow.AddMinutes(-5)
        };

        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "REFRESH")).ReturnsAsync(expiredTokenRow);

        await Assert.ThrowsAsync<AuthException>(() => service.RefreshAsync(token));
    }

    [Fact]
    public async Task Refresh_DisabledUser_Throws401()
    {
        // UTCID05: User account disabled throws AuthException (UserInactive)
        var service = CreateService();
        var token = "valid-refresh-token";
        var tokenHash = MagicLinkTokenCodec.Hash(token);
        var tokenRow = new UserAuthToken
        {
            TokenId = 1L,
            UserId = 13L,
            CompanyId = 6L,
            Purpose = "REFRESH",
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };
        var disabledUser = MakeUser("Disabled");

        _tokenRepo.Setup(r => r.GetByHashAsync(tokenHash, "REFRESH")).ReturnsAsync(tokenRow);
        _userRepo.Setup(r => r.GetByIdCrossTenantAsync(13L)).ReturnsAsync(disabledUser);

        await Assert.ThrowsAsync<AuthException>(() => service.RefreshAsync(token));
    }
}
