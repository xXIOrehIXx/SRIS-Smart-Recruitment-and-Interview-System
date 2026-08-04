using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Serilog;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class OfferServiceTests
{
    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<IJobRepo> _jobRepo = new();
    private readonly Mock<IOfferRepo> _offerRepo = new();
    private readonly Mock<IApplicationStateService> _stateService = new();
    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<INotificationService> _notification = new();
    private readonly Mock<IActivityLogRepo> _activityLogRepo = new();
    private readonly Mock<IContextData> _contextData = new();
    private readonly Mock<ILogger> _logger = new();

    private OfferService CreateService()
    {
        _logger.Setup(l => l.ForContext<OfferService>()).Returns(_logger.Object);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_jobRepo.Object);
            s.AddSingleton(_offerRepo.Object);
            s.AddSingleton(_stateService.Object);
            s.AddSingleton(_magicLink.Object);
            s.AddSingleton(_notification.Object);
            s.AddSingleton(_activityLogRepo.Object);
            s.AddSingleton(_contextData.Object);
            s.AddSingleton(_logger.Object);
        });
        return new OfferService(provider);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Throw_Conflict_If_State_Not_Offer()
    {
        // Arrange
        var svc = CreateService();
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, CurrentState = "Interviewing" }; // Not Offer
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(app);

        var dto = new MakeOfferDto { SalaryAmount = 1000, Currency = "USD" };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.MakeOfferAsync(1L, 100L, 1L, dto));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Throw_Conflict_If_Offer_Already_Exists()
    {
        // Arrange
        var svc = CreateService();
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, CurrentState = "Offer" };
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(app);
        
        var existingOffer = new OfferDetail { OfferId = 10 };
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 1L)).ReturnsAsync(existingOffer); // Offer exists

        var dto = new MakeOfferDto { SalaryAmount = 1000, Currency = "USD" };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.MakeOfferAsync(1L, 100L, 1L, dto));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Insert_Offer_And_Issue_MagicLink()
    {
        // Arrange
        var svc = CreateService();
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, CurrentState = "Offer" };
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(app);
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 1L)).ReturnsAsync((OfferDetail)null!); // No existing offer

        _offerRepo.Setup(r => r.InsertAsync(1L, It.IsAny<OfferDetail>()))
            .Callback<long, OfferDetail>((c, o) => o.OfferId = 50)
            .ReturnsAsync(50L);

        _magicLink.Setup(m => m.IssueAsync(1L, 1L, "OFFER_RESPONSE", It.IsAny<TimeSpan>()))
            .ReturnsAsync(new MagicLinkIssued(1, "magic-token-123", "OFFER_RESPONSE", DateTime.UtcNow.AddDays(7)));

        var dto = new MakeOfferDto { SalaryAmount = 2000, Currency = "VND", StartDate = new DateTime(2025, 1, 1) };

        // Act
        var result = await svc.MakeOfferAsync(1L, 100L, 1L, dto);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("magic-token-123", result.MagicToken);
        Assert.Equal(50, result.Offer.OfferId);
        
        _offerRepo.Verify(r => r.InsertAsync(1L, It.Is<OfferDetail>(o => o.SalaryAmount == 2000 && o.Currency == "VND")), Times.Once);
        _activityLogRepo.Verify(r => r.InsertAsync(1L, It.Is<ActivityLog>(a => a.Action == "OFFER_MADE")), Times.Once);
    }
}
