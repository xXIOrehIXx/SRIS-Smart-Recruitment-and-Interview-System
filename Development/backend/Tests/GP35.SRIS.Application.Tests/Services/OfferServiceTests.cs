using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Pdf;
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
    private readonly Mock<ICompanyRepo> _companyRepo = new();
    private readonly Mock<IUserRepo> _userRepo = new();
    private readonly Mock<IApplicationStateService> _stateService = new();
    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<INotificationService> _notification = new();
    private readonly Mock<IOfferLetterPdfGenerator> _pdf = new();
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
            s.AddSingleton(_companyRepo.Object);
            s.AddSingleton(_userRepo.Object);
            s.AddSingleton(_stateService.Object);
            s.AddSingleton(_magicLink.Object);
            s.AddSingleton(_notification.Object);
            s.AddSingleton(_pdf.Object);
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
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, JobId = 7, CurrentState = "Offer" };
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
        _activityLogRepo.Verify(r => r.InsertAsync(1L, It.Is<ActivityLog>(a => a.Action == "OFFER_LETTER_SENT")), Times.Once);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Fill_Blank_Fields_From_Job()
    {
        // Ô để trống -> lấy mặc định từ Job, KHÔNG để thư trống mục (5.15).
        var svc = CreateService();
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, JobId = 7, CurrentState = "Offer" };
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(app);
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 1L)).ReturnsAsync((OfferDetail)null!);
        _jobRepo.Setup(r => r.GetByIdAsync(1L, 7L)).ReturnsAsync(new Job
        {
            JobId = 7,
            Title = "Kế toán tổng hợp",
            Department = "Tài chính",
            EmploymentType = "Toàn thời gian",
            Location = "Hà Nội"
        });
        _offerRepo.Setup(r => r.InsertAsync(1L, It.IsAny<OfferDetail>())).ReturnsAsync(50L);
        _magicLink.Setup(m => m.IssueAsync(1L, 1L, "OFFER_RESPONSE", It.IsAny<TimeSpan>()))
            .ReturnsAsync(new MagicLinkIssued(1, "tok", "OFFER_RESPONSE", DateTime.UtcNow.AddDays(7)));

        // Chỉ nhập lương, mọi mục vị trí bỏ trống.
        var result = await svc.MakeOfferAsync(1L, 100L, 1L, new MakeOfferDto { SalaryAmount = 20_000_000 });

        Assert.Equal("Kế toán tổng hợp", result.Offer.JobTitle);
        Assert.Equal("Tài chính", result.Offer.Department);
        Assert.Equal("Toàn thời gian", result.Offer.EmploymentType);
        Assert.Equal("Hà Nội", result.Offer.WorkLocation);
        // Điều khoản mặc định của mẫu thư phải được điền sẵn, không để rỗng.
        Assert.False(string.IsNullOrWhiteSpace(result.Offer.Terms));
    }

    /// <summary>Hồ sơ đang ở OFFER — điều kiện chung của mọi test ghi nhận kết quả.</summary>
    private void SetupApplicationAtOffer(long appId = 100L) =>
        _appRepo.Setup(r => r.GetByIdAsync(1L, appId)).ReturnsAsync(
            new GP35.SRIS.Domain.Entities.Application { ApplicationId = appId, JobId = 7, CurrentState = "OFFER" });

    [Fact]
    public async Task RecordOutcomeAsync_Accepted_Should_Move_Application_To_Hired()
    {
        var svc = CreateService();
        SetupApplicationAtOffer();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "PENDING" });
        _offerRepo.Setup(r => r.SetOutcomeAsync(1L, 10L, "ACCEPTED", 9L, null, It.IsAny<DateTime>()))
            .ReturnsAsync(1);

        var result = await svc.RecordOutcomeAsync(1L, 9L, 100L, new OfferOutcomeDto { Accepted = true });

        Assert.Equal("ACCEPTED", result.OfferStatus);
        Assert.Equal("HIRED", result.ApplicationState);
        // isCandidateAnswer = true: ghi nhận câu trả lời, KHÔNG áp luật "chỉ DM của job" (5.14)
        // — job có gán DM mà bắt đúng DM mới ghi được thì Human Resource cầm email trả lời cũng chịu.
        _stateService.Verify(s => s.TransitionAsync(1L, 9L, 100L, "HIRED", null, true), Times.Once);
        _activityLogRepo.Verify(
            r => r.InsertAsync(1L, It.Is<ActivityLog>(a => a.Action == "OFFER_ACCEPTED")), Times.Once);
    }

    [Fact]
    public async Task RecordOutcomeAsync_Should_Not_Touch_Offer_If_Application_Left_Offer_State()
    {
        // Hồ sơ đã bị loại đường khác: phải chặn TRƯỚC khi ghi status offer, không thì offer
        // thành ACCEPTED trong khi hồ sơ đang REJECTED (hai bảng lệch nhau).
        var svc = CreateService();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "PENDING" });
        _appRepo.Setup(r => r.GetByIdAsync(1L, 100L)).ReturnsAsync(
            new GP35.SRIS.Domain.Entities.Application { ApplicationId = 100, JobId = 7, CurrentState = "REJECTED" });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.RecordOutcomeAsync(1L, 9L, 100L, new OfferOutcomeDto { Accepted = true }));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        _offerRepo.Verify(r => r.SetOutcomeAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(),
            It.IsAny<long?>(), It.IsAny<string>(), It.IsAny<DateTime>()), Times.Never);
    }

    [Fact]
    public async Task RecordOutcomeAsync_Declined_Should_Move_Application_To_Rejected_With_Note_As_Reason()
    {
        var svc = CreateService();
        SetupApplicationAtOffer();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "PENDING" });
        _offerRepo.Setup(r => r.SetOutcomeAsync(1L, 10L, "DECLINED", 9L, "Nhận offer công ty khác", It.IsAny<DateTime>()))
            .ReturnsAsync(1);

        var result = await svc.RecordOutcomeAsync(
            1L, 9L, 100L, new OfferOutcomeDto { Accepted = false, Note = "Nhận offer công ty khác" });

        Assert.Equal("DECLINED", result.OfferStatus);
        Assert.Equal("REJECTED", result.ApplicationState);
        _stateService.Verify(
            s => s.TransitionAsync(1L, 9L, 100L, "REJECTED", "Nhận offer công ty khác", true), Times.Once);
    }

    [Fact]
    public async Task RecordOutcomeAsync_Should_Throw_Conflict_If_Already_Recorded()
    {
        var svc = CreateService();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "ACCEPTED" });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.RecordOutcomeAsync(1L, 9L, 100L, new OfferOutcomeDto { Accepted = true }));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        _stateService.Verify(
            s => s.TransitionAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
    }

    [Fact]
    public async Task RecordOutcomeAsync_Should_Not_Transition_When_Optimistic_Lock_Loses()
    {
        // Hai người bấm cùng lúc: rowcount=0 -> KHÔNG được đẩy state lần hai.
        var svc = CreateService();
        SetupApplicationAtOffer();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "PENDING" });
        _offerRepo.Setup(r => r.SetOutcomeAsync(
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(),
                It.IsAny<long?>(), It.IsAny<string>(), It.IsAny<DateTime>()))
            .ReturnsAsync(0);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.RecordOutcomeAsync(1L, 9L, 100L, new OfferOutcomeDto { Accepted = true }));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        _stateService.Verify(
            s => s.TransitionAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
    }
}
