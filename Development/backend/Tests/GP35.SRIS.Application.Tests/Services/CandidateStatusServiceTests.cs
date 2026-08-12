using GP35.SRIS.Application.Contracts.Dtos.Candidate.Status;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class CandidateStatusServiceTests
{
    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<IApplicationRepo> _appRepo = new();

    private CandidateStatusService CreateService()
    {
        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_magicLink.Object);
            s.AddSingleton(_appRepo.Object);
        });
        return new CandidateStatusService(provider);
    }

    [Fact]
    public async Task GetStatus_ValidToken_ReturnsStatusDto()
    {
        // UTCID01: Happy path
        var service = CreateService();
        var rawToken = "valid-status-token";
        
        _magicLink.Setup(m => m.ValidateAsync(rawToken, "STATUS"))
            .ReturnsAsync(new MagicLinkValidation(1L, 5L, 100L, "STATUS"));

        _appRepo.Setup(r => r.GetContactInfoAsync(1L, 100L))
            .ReturnsAsync(new ApplicationContactInfo(100L, "a@b.com", "Nguyen Van A", "Dotnet Dev", "INTERVIEW"));

        _appRepo.Setup(r => r.GetByIdAsync(1L, 100L))
            .ReturnsAsync(new GP35.SRIS.Domain.Entities.Application { ApplicationId = 100L, StageUpdatedAt = DateTime.UtcNow });

        var result = await service.GetStatusAsync(rawToken);

        Assert.NotNull(result);
        Assert.Equal("Nguyen Van A", result.CandidateName);
        Assert.Equal("Dotnet Dev", result.JobTitle);
        Assert.Equal("INTERVIEW", result.CurrentStage);
        Assert.False(result.IsClosed);
    }

    [Fact]
    public async Task GetStatus_ApplicationNotFound_Throws404()
    {
        // UTCID02: Application not found
        var service = CreateService();
        var rawToken = "valid-status-token";

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "STATUS"))
            .ReturnsAsync(new MagicLinkValidation(1L, 5L, 100L, "STATUS"));

        _appRepo.Setup(r => r.GetContactInfoAsync(1L, 100L))
            .ReturnsAsync((ApplicationContactInfo?)null);

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.GetStatusAsync(rawToken));
        Assert.Equal("NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task GetStatus_InvalidOrExpiredToken_ThrowsException()
    {
        // UTCID03: Invalid or expired token
        var service = CreateService();
        var rawToken = "invalid-token";

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "STATUS"))
            .ThrowsAsync(new BaseException("Token expired") { ErrorCode = "UNAUTHORIZED" });

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.GetStatusAsync(rawToken));
        Assert.Equal("UNAUTHORIZED", ex.ErrorCode);
    }
}
