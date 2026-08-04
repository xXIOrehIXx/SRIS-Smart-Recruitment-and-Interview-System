using GP35.SRIS.Application.Contracts.Dtos.Candidate.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Serilog;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class CandidateOfferServiceTests
{
    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<IOfferRepo> _offerRepo = new();
    private readonly Mock<IApplicationStateService> _stateService = new();
    private readonly Mock<IActivityLogRepo> _activityLogRepo = new();
    private readonly Mock<ILogger> _logger = new();

    private CandidateOfferService CreateService()
    {
        _logger.Setup(l => l.ForContext<CandidateOfferService>()).Returns(_logger.Object);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_magicLink.Object);
            s.AddSingleton(_offerRepo.Object);
            s.AddSingleton(_stateService.Object);
            s.AddSingleton(_activityLogRepo.Object);
            s.AddSingleton(_logger.Object);
        });
        return new CandidateOfferService(provider);
    }

    [Fact]
    public async Task AcceptOfferAsync_Should_Change_State_To_Offered()
    {
        // Arrange
        var svc = CreateService();
        var rawToken = "token123";
        var companyId = 1L;
        var appId = 100L;

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "OFFER_RESPONSE"))
            .ReturnsAsync(new MagicLinkValidation(companyId, 5L, appId, "OFFER_RESPONSE"));

        var offer = new OfferDetail { OfferId = 10, Status = "Pending", ExpiresAt = DateTime.UtcNow.AddDays(1) };
        _offerRepo.Setup(r => r.GetByApplicationAsync(companyId, appId)).ReturnsAsync(offer);
        _offerRepo.Setup(r => r.SetResponseAsync(companyId, 10, It.IsAny<string>(), It.IsAny<DateTime>())).ReturnsAsync(1);

        var dto = new OfferResponseDto { Accept = true };

        // Act
        var result = await svc.RespondAsync(rawToken, dto);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("ACCEPTED", result.OfferStatus);
        Assert.Equal("HIRED", result.ApplicationState);

        _stateService.Verify(s => s.TransitionAsync(companyId, 0, appId, "HIRED", null), Times.Once);
        _magicLink.Verify(m => m.MarkUsedAsync(companyId, 5L), Times.Once);
        _activityLogRepo.Verify(r => r.InsertAsync(companyId, It.Is<ActivityLog>(a => a.Action == "OFFER_ACCEPTED")), Times.Once);
    }

    [Fact]
    public async Task RejectOfferAsync_Should_Change_State_To_Rejected()
    {
        // Arrange
        var svc = CreateService();
        var rawToken = "token123";
        var companyId = 1L;
        var appId = 100L;

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "OFFER_RESPONSE"))
            .ReturnsAsync(new MagicLinkValidation(companyId, 5L, appId, "OFFER_RESPONSE"));

        var offer = new OfferDetail { OfferId = 10, Status = "Pending", ExpiresAt = DateTime.UtcNow.AddDays(1) };
        _offerRepo.Setup(r => r.GetByApplicationAsync(companyId, appId)).ReturnsAsync(offer);
        _offerRepo.Setup(r => r.SetResponseAsync(companyId, 10, It.IsAny<string>(), It.IsAny<DateTime>())).ReturnsAsync(1);

        var dto = new OfferResponseDto { Accept = false };

        // Act
        var result = await svc.RespondAsync(rawToken, dto);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("DECLINED", result.OfferStatus);
        Assert.Equal("REJECTED", result.ApplicationState);

        _stateService.Verify(s => s.TransitionAsync(companyId, 0, appId, "REJECTED", "Ứng viên từ chối offer."), Times.Once);
        _magicLink.Verify(m => m.MarkUsedAsync(companyId, 5L), Times.Once);
        _activityLogRepo.Verify(r => r.InsertAsync(companyId, It.Is<ActivityLog>(a => a.Action == "OFFER_DECLINED")), Times.Once);
    }
}
