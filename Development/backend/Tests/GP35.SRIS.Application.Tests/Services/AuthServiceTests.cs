using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
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

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_userRepo.Object);
            s.AddSingleton(_companyRepo.Object);
            s.AddSingleton(_tokenRepo.Object);
            s.AddSingleton(_encode.Object);
            s.AddSingleton(_jwt.Object);
            s.AddSingleton(_email.Object);
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
}
