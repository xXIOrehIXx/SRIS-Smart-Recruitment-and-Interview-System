using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Serilog;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class InterviewPoolServiceTests
{
    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<ISchedulingRepo> _schedulingRepo = new();
    private readonly Mock<IUserRepo> _userRepo = new();
    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<IActivityLogRepo> _activityLogRepo = new();
    private readonly Mock<INotificationService> _notify = new();
    private readonly Mock<IApplicationStateService> _stateService = new();
    private readonly Mock<ILogger> _logger = new();

    private InterviewPoolService CreateService()
    {
        _logger.Setup(l => l.ForContext<InterviewPoolService>()).Returns(_logger.Object);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_schedulingRepo.Object);
            s.AddSingleton(_userRepo.Object);
            s.AddSingleton(_magicLink.Object);
            s.AddSingleton(_activityLogRepo.Object);
            s.AddSingleton(_notify.Object);
            s.AddSingleton(_stateService.Object);
            s.AddSingleton(_logger.Object);
        });
        return new InterviewPoolService(provider);
    }

    [Fact]
    public async Task InviteAsync_Should_Skip_If_AdvanceState_Throws()
    {
        // Arrange
        var svc = CreateService();
        var pool = new InterviewSlotPool { PoolId = 10, Status = "Open", RoundNumber = 1 };
        _schedulingRepo.Setup(r => r.GetPoolByIdAsync(1L, 10L)).ReturnsAsync(pool);
        
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 100 };
        _appRepo.Setup(r => r.GetByIdAsync(1L, 100L)).ReturnsAsync(app);

        // Mock state service throws exception when advancing
        _stateService.Setup(s => s.AdvanceToAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>()))
            .ThrowsAsync(new BaseException("State error") { ErrorCode = "CONFLICT", ErrorMessage = "State error" });

        var dto = new InvitePoolDto { ApplicationIds = new List<long> { 100 } };

        // Act
        var result = await svc.InviteAsync(1L, 1L, 10L, dto);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result.Invited);
        Assert.Single(result.Skipped);
        Assert.Equal(100, result.Skipped[0].ApplicationId);
        Assert.Equal("State error", result.Skipped[0].Reason);
    }

    [Fact]
    public async Task CancelPoolAsync_Should_Cancel_And_Notify_Confirmed_Candidates()
    {
        // Arrange
        var svc = CreateService();
        var pool = new InterviewSlotPool { PoolId = 10, JobId = 5 };
        _schedulingRepo.Setup(r => r.GetPoolByIdAsync(1L, 10L)).ReturnsAsync(pool);

        var schedules = new List<InterviewSchedule>
        {
            new InterviewSchedule { ScheduleId = 1, ApplicationId = 100, Status = "Confirmed", ConfirmedSlotId = 20 }
        };
        _schedulingRepo.Setup(r => r.GetSchedulesByPoolAsync(1L, 10L)).ReturnsAsync(schedules);
        _schedulingRepo.Setup(r => r.CancelPoolAsync(1L, 10L)).ReturnsAsync(true);
        _schedulingRepo.Setup(r => r.GetSlotAsync(1L, 20L))
            .ReturnsAsync(new InterviewSlot { SlotId = 20, StartTime = new DateTime(2025, 1, 1) });

        var dto = new CancelPoolDto { Reason = "No longer needed" };

        // Act
        await svc.CancelPoolAsync(1L, 1L, 10L, dto);

        // Assert
        _schedulingRepo.Verify(r => r.CancelPoolAsync(1L, 10L), Times.Once);
        _notify.Verify(n => n.SendInterviewCancelledAsync(1L, 100L, It.IsAny<DateTime?>(), "No longer needed"), Times.Once);
        _activityLogRepo.Verify(r => r.InsertAsync(1L, It.Is<ActivityLog>(a => a.Action == "INTERVIEW_CANCELLED")), Times.Once);
    }
}
