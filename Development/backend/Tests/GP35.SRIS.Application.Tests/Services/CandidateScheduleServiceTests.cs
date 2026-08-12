using GP35.SRIS.Application.Contracts.Dtos.Candidate.Schedule;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;
using Serilog;

namespace GP35.SRIS.Application.Tests.Services;

public class CandidateScheduleServiceTests
{
    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<ISchedulingRepo> _schedulingRepo = new();
    private readonly Mock<IActivityLogRepo> _activityLogRepo = new();
    private readonly Mock<INotificationService> _notify = new();
    private readonly Mock<ILogger> _logger = new();

    private CandidateScheduleService CreateService()
    {
        _logger.Setup(l => l.ForContext<CandidateScheduleService>()).Returns(_logger.Object);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_magicLink.Object);
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_schedulingRepo.Object);
            s.AddSingleton(_activityLogRepo.Object);
            s.AddSingleton(_notify.Object);
            s.AddSingleton(_logger.Object);
        });
        return new CandidateScheduleService(provider);
    }

    [Fact]
    public async Task GetSchedule_ValidToken_ReturnsScheduleDto()
    {
        // UTCID01 / Sheet: GetScheduleAsync
        var service = CreateService();
        var rawToken = "valid-schedule-token";
        var companyId = 1L;
        var appId = 100L;

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "SCHEDULE"))
            .ReturnsAsync(new MagicLinkValidation(companyId, 5L, appId, "SCHEDULE"));

        var schedule = new InterviewSchedule
        {
            ScheduleId = 200L,
            ApplicationId = appId,
            RoundNumber = 1,
            Status = "PENDING",
            PoolId = 300L
        };

        _schedulingRepo.Setup(r => r.GetLatestScheduleAsync(companyId, appId)).ReturnsAsync(schedule);
        _schedulingRepo.Setup(r => r.GetSlotsByPoolAsync(companyId, 300L, true)).ReturnsAsync(new List<InterviewSlot>
        {
            new InterviewSlot { SlotId = 10L, StartTime = DateTime.UtcNow.AddDays(1) }
        });

        var result = await service.GetScheduleAsync(rawToken);

        Assert.NotNull(result);
        Assert.Equal(200L, result.ScheduleId);
        Assert.Equal("PENDING", result.Status);
        Assert.Single(result.Slots);
        Assert.Equal(10L, result.Slots[0].SlotId);
    }

    [Fact]
    public async Task GetSchedule_NoPendingSchedules_ThrowsConflict()
    {
        var service = CreateService();
        var rawToken = "valid-schedule-token";
        var companyId = 1L;
        var appId = 100L;

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "SCHEDULE"))
            .ReturnsAsync(new MagicLinkValidation(companyId, 5L, appId, "SCHEDULE"));

        _schedulingRepo.Setup(r => r.GetLatestScheduleAsync(companyId, appId)).ReturnsAsync((InterviewSchedule?)null);

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.GetScheduleAsync(rawToken));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task Confirm_Success_BooksSlotAndFiresNotification()
    {
        // UTCID01 / Sheet: ConfirmAsync
        var service = CreateService();
        var rawToken = "valid-schedule-token";
        var companyId = 1L;
        var appId = 100L;
        var slotId = 10L;

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "SCHEDULE"))
            .ReturnsAsync(new MagicLinkValidation(companyId, 5L, appId, "SCHEDULE"));

        var slot = new InterviewSlot
        {
            SlotId = slotId,
            PoolId = 300L,
            Status = "Open",
            StartTime = DateTime.Now.AddDays(1),
            Interviewers = new List<InterviewSlotInterviewer>()
        };

        _schedulingRepo.Setup(r => r.GetSlotAsync(companyId, slotId)).ReturnsAsync(slot);
        _schedulingRepo.Setup(r => r.GetPendingScheduleInPoolAsync(companyId, appId, 300L))
            .ReturnsAsync(new InterviewSchedule { ScheduleId = 200L, RoundNumber = 1 });
        _schedulingRepo.Setup(r => r.FindCandidateBusyAtAsync(companyId, appId, slot.StartTime, It.IsAny<TimeSpan>(), 200L))
            .ReturnsAsync((DateTime?)null);
        _schedulingRepo.Setup(r => r.FindBusyInterviewerAsync(companyId, It.IsAny<List<long>>(), slot.StartTime, It.IsAny<TimeSpan>(), slotId))
            .ReturnsAsync((BusyInterviewer?)null);
        _schedulingRepo.Setup(r => r.BookAndConfirmAsync(companyId, 200L, slotId, appId)).ReturnsAsync(true);

        var dto = new ConfirmSlotDto { SlotId = slotId };
        var result = await service.ConfirmAsync(rawToken, dto);

        Assert.NotNull(result);
        Assert.Equal(200L, result.ScheduleId);
        Assert.Equal("CONFIRMED", result.Status);
        _magicLink.Verify(m => m.MarkUsedAsync(companyId, 5L), Times.Once);
        _notify.Verify(n => n.SendInterviewConfirmedAsync(companyId, appId, slot.StartTime), Times.Once);
    }

    [Fact]
    public async Task Confirm_AlreadyBookedSlot_ThrowsConflict()
    {
        var service = CreateService();
        var rawToken = "valid-schedule-token";
        var companyId = 1L;
        var appId = 100L;
        var slotId = 10L;

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "SCHEDULE"))
            .ReturnsAsync(new MagicLinkValidation(companyId, 5L, appId, "SCHEDULE"));

        var slot = new InterviewSlot
        {
            SlotId = slotId,
            PoolId = 300L,
            Status = "Booked",
            StartTime = DateTime.Now.AddDays(1)
        };

        _schedulingRepo.Setup(r => r.GetSlotAsync(companyId, slotId)).ReturnsAsync(slot);

        var dto = new ConfirmSlotDto { SlotId = slotId };
        var ex = await Assert.ThrowsAsync<BaseException>(() => service.ConfirmAsync(rawToken, dto));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task Confirm_InvalidToken_ThrowsUnauthorized()
    {
        // UTCID02: Invalid or expired token
        var service = CreateService();
        var rawToken = "invalid-token";

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "SCHEDULE"))
            .ThrowsAsync(new BaseException("Token expired") { ErrorCode = "UNAUTHORIZED" });

        var dto = new ConfirmSlotDto { SlotId = 10L };
        var ex = await Assert.ThrowsAsync<BaseException>(() => service.ConfirmAsync(rawToken, dto));
        Assert.Equal("UNAUTHORIZED", ex.ErrorCode);
    }

    [Fact]
    public async Task NoSlotFits_Success_UpdatesStatusAndBurnsToken()
    {
        // UTCID01 / Sheet: NoSlotFitsAsync
        var service = CreateService();
        var rawToken = "valid-schedule-token";
        var companyId = 1L;
        var appId = 100L;

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "SCHEDULE"))
            .ReturnsAsync(new MagicLinkValidation(companyId, 5L, appId, "SCHEDULE"));

        _schedulingRepo.Setup(r => r.GetLatestPendingScheduleAsync(companyId, appId))
            .ReturnsAsync(new InterviewSchedule { ScheduleId = 200L, RoundNumber = 1 });

        await service.NoSlotFitsAsync(rawToken);

        _schedulingRepo.Verify(r => r.SetScheduleStatusAsync(companyId, 200L, "NO_SLOT_FITS"), Times.Once);
        _magicLink.Verify(m => m.MarkUsedAsync(companyId, 5L), Times.Once);
        _activityLogRepo.Verify(r => r.InsertAsync(companyId, It.Is<ActivityLog>(a => a.Action == "INTERVIEW_NO_SLOT_FITS")), Times.Once);
    }

    [Fact]
    public async Task NoSlotFits_InvalidToken_ThrowsUnauthorized()
    {
        // UTCID02: Invalid or expired token
        var service = CreateService();
        var rawToken = "invalid-token";

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "SCHEDULE"))
            .ThrowsAsync(new BaseException("Token expired") { ErrorCode = "UNAUTHORIZED" });

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.NoSlotFitsAsync(rawToken));
        Assert.Equal("UNAUTHORIZED", ex.ErrorCode);
    }

    [Fact]
    public async Task NoSlotFits_NoPendingSchedule_ThrowsConflict()
    {
        // UTCID03: No pending schedule
        var service = CreateService();
        var rawToken = "valid-token";
        var companyId = 1L;
        var appId = 100L;

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "SCHEDULE"))
            .ReturnsAsync(new MagicLinkValidation(companyId, 5L, appId, "SCHEDULE"));

        _schedulingRepo.Setup(r => r.GetLatestPendingScheduleAsync(companyId, appId))
            .ReturnsAsync((InterviewSchedule?)null);

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.NoSlotFitsAsync(rawToken));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task GetSchedule_InvalidOrExpiredToken_ThrowsException()
    {
        // UTCID03: Invalid or expired token
        var service = CreateService();
        var rawToken = "invalid-token";

        _magicLink.Setup(m => m.ValidateAsync(rawToken, "SCHEDULE"))
            .ThrowsAsync(new BaseException("Token expired") { ErrorCode = "UNAUTHORIZED" });

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.GetScheduleAsync(rawToken));
        Assert.Equal("UNAUTHORIZED", ex.ErrorCode);
    }
}
