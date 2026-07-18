using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Domain.Shared.Security;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// MagicLinkService (docs 5.13): DB chỉ lưu HASH; "one-time" = đốt khi CHỐT chứ không
/// phải khi mở; sai purpose / đã dùng / hết hạn đều bị chặn.
/// </summary>
public class MagicLinkServiceTests
{
    private const long CompanyId = 6;
    private const long AppId = 100;

    private readonly Mock<IMagicLinkTokenRepo> _tokenRepo = new();
    private readonly Mock<INotificationService> _notify = new();

    private MagicLinkService CreateService()
    {
        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_tokenRepo.Object);
            s.AddSingleton(_notify.Object);
        });
        return new MagicLinkService(provider);
    }

    // ===== Issue =====

    [Fact]
    public async Task Issue_StoresHashNotRawToken()
    {
        MagicLinkToken? stored = null;
        _tokenRepo.Setup(r => r.InsertAsync(CompanyId, It.IsAny<MagicLinkToken>()))
            .Callback<long, MagicLinkToken>((_, t) => stored = t)
            .ReturnsAsync(1L);

        var service = CreateService();
        var issued = await service.IssueAsync(CompanyId, AppId, "STATUS");

        Assert.NotNull(stored);
        Assert.NotEqual(issued.RawToken, stored!.TokenHash);                       // KHÔNG lưu gốc
        Assert.Equal(MagicLinkTokenCodec.Hash(issued.RawToken), stored.TokenHash); // lưu đúng hash
        Assert.StartsWith($"{CompanyId}.", issued.RawToken);                       // prefix tenant
    }

    [Fact]
    public async Task Issue_NormalizesPurpose_AndSendsEmail()
    {
        _tokenRepo.Setup(r => r.InsertAsync(CompanyId, It.IsAny<MagicLinkToken>())).ReturnsAsync(1L);

        var service = CreateService();
        var issued = await service.IssueAsync(CompanyId, AppId, "  schedule ");

        Assert.Equal("SCHEDULE", issued.Purpose);
        _notify.Verify(n => n.SendMagicLinkAsync(
            CompanyId, AppId, "SCHEDULE", issued.RawToken, It.IsAny<DateTime>()), Times.Once);
    }

    [Theory]
    [InlineData("QUIZ")] // quiz đã loại khỏi scope — purpose không còn hợp lệ
    [InlineData("")]
    [InlineData("PASSWORD_RESET")]
    public async Task Issue_InvalidPurpose_Throws400(string purpose)
    {
        var service = CreateService();
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.IssueAsync(CompanyId, AppId, purpose));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Theory]
    [InlineData("SCHEDULE", 5)]
    [InlineData("OFFER_RESPONSE", 7)]
    [InlineData("STATUS", 30)]
    public async Task Issue_DefaultTtlPerPurpose(string purpose, int days)
    {
        _tokenRepo.Setup(r => r.InsertAsync(CompanyId, It.IsAny<MagicLinkToken>())).ReturnsAsync(1L);

        var service = CreateService();
        var before = DateTime.UtcNow;
        var issued = await service.IssueAsync(CompanyId, AppId, purpose);

        var expected = before.AddDays(days);
        Assert.InRange(issued.ExpiresAt, expected.AddMinutes(-1), expected.AddMinutes(1));
    }

    // ===== Validate =====

    private MagicLinkToken MakeToken(string raw, string purpose = "SCHEDULE",
        DateTime? usedAt = null, DateTime? expiresAt = null) => new()
    {
        TokenId = 9,
        CompanyId = CompanyId,
        ApplicationId = AppId,
        TokenHash = MagicLinkTokenCodec.Hash(raw),
        Purpose = purpose,
        UsedAt = usedAt,
        ExpiresAt = expiresAt ?? DateTime.UtcNow.AddDays(1)
    };

    [Fact]
    public async Task Validate_HappyPath_CountsAccess_DoesNotBurn()
    {
        var raw = MagicLinkTokenCodec.Generate(CompanyId);
        _tokenRepo.Setup(r => r.GetByHashAsync(CompanyId, MagicLinkTokenCodec.Hash(raw)))
            .ReturnsAsync(MakeToken(raw));

        var service = CreateService();
        var result = await service.ValidateAsync(raw, "SCHEDULE");

        Assert.Equal(CompanyId, result.CompanyId);
        Assert.Equal(AppId, result.ApplicationId);
        _tokenRepo.Verify(r => r.IncrementAccessAsync(CompanyId, 9), Times.Once); // đếm lần mở
        _tokenRepo.Verify(r => r.MarkUsedAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never); // KHÔNG đốt khi mở
    }

    [Fact]
    public async Task Validate_TokenWithoutTenantPrefix_Throws401()
    {
        var service = CreateService();
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.ValidateAsync("token-khong-co-prefix", "SCHEDULE"));
        Assert.Equal("INVALID_MAGIC_LINK", ex.ErrorCode);
    }

    [Fact]
    public async Task Validate_UnknownToken_Throws401()
    {
        _tokenRepo.Setup(r => r.GetByHashAsync(CompanyId, It.IsAny<string>()))
            .ReturnsAsync((MagicLinkToken?)null);

        var service = CreateService();
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.ValidateAsync($"{CompanyId}.token-la", "SCHEDULE"));
        Assert.Equal("INVALID_MAGIC_LINK", ex.ErrorCode);
    }

    [Fact]
    public async Task Validate_WrongPurpose_Throws401()
    {
        var raw = MagicLinkTokenCodec.Generate(CompanyId);
        _tokenRepo.Setup(r => r.GetByHashAsync(CompanyId, MagicLinkTokenCodec.Hash(raw)))
            .ReturnsAsync(MakeToken(raw, purpose: "STATUS"));

        var service = CreateService();
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.ValidateAsync(raw, "OFFER_RESPONSE"));
        Assert.Equal("INVALID_MAGIC_LINK", ex.ErrorCode);
    }

    [Fact]
    public async Task Validate_AlreadyUsed_Throws410()
    {
        var raw = MagicLinkTokenCodec.Generate(CompanyId);
        _tokenRepo.Setup(r => r.GetByHashAsync(CompanyId, MagicLinkTokenCodec.Hash(raw)))
            .ReturnsAsync(MakeToken(raw, usedAt: DateTime.UtcNow.AddHours(-1)));

        var service = CreateService();
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.ValidateAsync(raw, "SCHEDULE"));
        Assert.Equal("MAGIC_LINK_EXPIRED", ex.ErrorCode);
    }

    [Fact]
    public async Task Validate_Expired_Throws410()
    {
        var raw = MagicLinkTokenCodec.Generate(CompanyId);
        _tokenRepo.Setup(r => r.GetByHashAsync(CompanyId, MagicLinkTokenCodec.Hash(raw)))
            .ReturnsAsync(MakeToken(raw, expiresAt: DateTime.UtcNow.AddMinutes(-1)));

        var service = CreateService();
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.ValidateAsync(raw, "SCHEDULE"));
        Assert.Equal("MAGIC_LINK_EXPIRED", ex.ErrorCode);
    }
}
