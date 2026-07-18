using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// ApplicationStateService (docs 5.8): forward-only + reject bắt buộc reason +
/// guard G2 (INTERVIEW→OFFER cần ≥1 phiếu chấm SUBMITTED) + ghi audit log.
/// </summary>
public class ApplicationStateServiceTests
{
    private const long CompanyId = 6;
    private const long UserId = 13;
    private const long AppId = 100;

    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<IActivityLogRepo> _logRepo = new();
    private readonly Mock<INotificationService> _notify = new();

    private ApplicationStateService CreateService(string currentState, int submittedScores = 0)
    {
        _appRepo.Setup(r => r.GetByIdAsync(CompanyId, AppId))
            .ReturnsAsync(new Domain.Entities.Application
            {
                ApplicationId = AppId,
                CompanyId = CompanyId,
                JobId = 1,
                CurrentState = currentState
            });
        _appRepo.Setup(r => r.TransitionStateAsync(
                CompanyId, AppId, It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(1);
        _appRepo.Setup(r => r.CountSubmittedInterviewScoresAsync(CompanyId, AppId))
            .ReturnsAsync(submittedScores);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_logRepo.Object);
            s.AddSingleton(_notify.Object);
        });
        return new ApplicationStateService(provider);
    }

    [Fact]
    public async Task Transition_ValidStep_UpdatesStateAndWritesAuditLog()
    {
        var service = CreateService("NEW");

        var result = await service.TransitionAsync(CompanyId, UserId, AppId, "SCREENING", null);

        Assert.Equal("NEW", result.FromState);
        Assert.Equal("SCREENING", result.ToState);
        _appRepo.Verify(r => r.TransitionStateAsync(
            CompanyId, AppId, "SCREENING", null, It.IsAny<DateTime>(), null, null), Times.Once);
        _logRepo.Verify(r => r.InsertAsync(CompanyId, It.Is<ActivityLog>(l =>
            l.Action == "STATE_CHANGE" && l.FromState == "NEW" && l.ToState == "SCREENING")), Times.Once);
    }

    [Fact]
    public async Task Transition_BackwardStep_Throws409()
    {
        var service = CreateService("SCREENING");

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "NEW", null));

        Assert.Equal("INVALID_TRANSITION", ex.ErrorCode);
        _appRepo.Verify(r => r.TransitionStateAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>()), Times.Never);
    }

    [Fact]
    public async Task Transition_SkipStep_Throws409()
    {
        var service = CreateService("NEW");
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "INTERVIEW", null));
        Assert.Equal("INVALID_TRANSITION", ex.ErrorCode);
    }

    [Fact]
    public async Task Transition_UnknownState_Throws400()
    {
        var service = CreateService("NEW");
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "INTERVIEW_2", null));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task Transition_ApplicationNotFound_Throws404()
    {
        var service = CreateService("NEW");
        _appRepo.Setup(r => r.GetByIdAsync(CompanyId, AppId)).ReturnsAsync((Domain.Entities.Application?)null);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "SCREENING", null));
        Assert.Equal("NOT_FOUND", ex.ErrorCode);
    }

    // ===== Guard G2 =====

    [Fact]
    public async Task InterviewToOffer_WithoutSubmittedScore_BlockedByGuardG2()
    {
        var service = CreateService("INTERVIEW", submittedScores: 0);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "OFFER", null));

        Assert.Equal("INVALID_TRANSITION", ex.ErrorCode);
        Assert.Contains("G2", ex.ErrorMessage);
    }

    [Fact]
    public async Task InterviewToOffer_WithOneSubmittedScore_Passes()
    {
        var service = CreateService("INTERVIEW", submittedScores: 1);

        var result = await service.TransitionAsync(CompanyId, UserId, AppId, "OFFER", null);

        Assert.Equal("OFFER", result.ToState);
    }

    // ===== Reject =====

    [Fact]
    public async Task Reject_WithoutReason_Throws400()
    {
        var service = CreateService("SCREENING");

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "REJECTED", "  "));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Theory]
    [InlineData("NEW")]
    [InlineData("SCREENING")]
    [InlineData("INTERVIEW")]
    [InlineData("OFFER")]
    public async Task Reject_FromAnyOpenState_PersistsReason(string from)
    {
        var service = CreateService(from);

        var result = await service.RejectAsync(CompanyId, UserId, AppId, "Không đạt yêu cầu");

        Assert.Equal("REJECTED", result.ToState);
        _appRepo.Verify(r => r.TransitionStateAsync(
            CompanyId, AppId, "REJECTED", "Không đạt yêu cầu",
            It.IsAny<DateTime>(), It.IsAny<DateTime?>(), null), Times.Once);
    }

    [Theory]
    [InlineData("HIRED")]
    [InlineData("REJECTED")]
    public async Task Reject_FromClosedState_Throws409(string from)
    {
        var service = CreateService(from);
        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.RejectAsync(CompanyId, UserId, AppId, "lý do"));
        Assert.Equal("INVALID_TRANSITION", ex.ErrorCode);
    }

    // ===== Email kết quả (best-effort) =====

    [Fact]
    public async Task Transition_ToHired_SendsResultNotification()
    {
        var service = CreateService("OFFER");

        await service.TransitionAsync(CompanyId, UserId, AppId, "HIRED", null);

        _notify.Verify(n => n.SendResultAsync(CompanyId, AppId, "HIRED"), Times.Once);
    }
}
