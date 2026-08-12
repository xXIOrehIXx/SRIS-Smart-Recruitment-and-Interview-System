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
    private readonly Mock<IEvaluationCriteriaRepo> _criteriaRepo = new();
    private readonly Mock<IUserRepo> _userRepo = new();
    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<IActivityLogRepo> _activityLogRepo = new();
    private readonly Mock<INotificationService> _notify = new();
    private readonly Mock<IApplicationStateService> _stateService = new();
    private readonly Mock<ILogger> _logger = new();

    private InterviewPoolService CreateService()
    {
        _logger.Setup(l => l.ForContext<InterviewPoolService>()).Returns(_logger.Object);

        // Mở lịch phỏng vấn đòi job có tiêu chí ĐÃ DUYỆT (nếu không interviewer nhận phiếu chấm
        // trống). Mặc định cho là có, để test không nói về tiêu chí khỏi phải dựng lại;
        // test nào cần nhánh "chưa có tiêu chí" thì override setup này.
        _criteriaRepo
            .Setup(r => r.GetByJobAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<bool>(), It.IsAny<bool>()))
            .ReturnsAsync(new List<EvaluationCriteria>
            {
                new() { CriteriaId = 1, Name = "Tiêu chí mẫu", Weight = 1, MaxScore = 10 }
            });

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_schedulingRepo.Object);
            s.AddSingleton(_criteriaRepo.Object);
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
    public async Task InviteAsync_Should_Block_When_Job_Has_No_Approved_Criteria()
    {
        var svc = CreateService();

        // Job chưa có tiêu chí duyệt -> mời được thì interviewer mở ra phiếu chấm trống 0/0.
        // Đè SAU CreateService(): Moq lấy setup đăng ký sau cùng.
        _criteriaRepo
            .Setup(r => r.GetByJobAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<bool>(), It.IsAny<bool>()))
            .ReturnsAsync(new List<EvaluationCriteria>());

        _schedulingRepo.Setup(r => r.GetPoolByIdAsync(1L, 10L))
            .ReturnsAsync(new InterviewSlotPool { PoolId = 10, JobId = 5, Status = "Open", RoundNumber = 1 });

        var ex = await Assert.ThrowsAsync<BaseException>(() =>
            svc.InviteAsync(1L, 1L, 10L, new InvitePoolDto { ApplicationIds = new List<long> { 100 } }));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        // Chặn TRƯỚC vòng lặp: không hồ sơ nào bị đẩy state khi cả job còn chưa chấm được.
        _stateService.Verify(
            s => s.AdvanceToAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>()),
            Times.Never);
    }

    [Fact]
    public async Task InviteAsync_Should_Skip_Candidate_Already_Confirmed_For_That_Round()
    {
        var svc = CreateService();
        _schedulingRepo.Setup(r => r.GetPoolByIdAsync(1L, 10L))
            .ReturnsAsync(new InterviewSlotPool { PoolId = 10, JobId = 5, Status = "Open", RoundNumber = 1 });
        _appRepo.Setup(r => r.GetByIdAsync(1L, 100L))
            .ReturnsAsync(new GP35.SRIS.Domain.Entities.Application { ApplicationId = 100, JobId = 5 });
        // Đã chốt vòng 1 ở pool KHÁC -> mời tiếp thành 2 buổi cùng vòng.
        _schedulingRepo.Setup(r => r.HasConfirmedScheduleForRoundAsync(1L, 100L, 1)).ReturnsAsync(true);

        var result = await svc.InviteAsync(1L, 1L, 10L, new InvitePoolDto { ApplicationIds = new List<long> { 100 } });

        Assert.Empty(result.Invited);
        Assert.Single(result.Skipped);
        Assert.Contains("vòng 1", result.Skipped[0].Reason);
        _stateService.Verify(
            s => s.AdvanceToAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>()),
            Times.Never);
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

    [Fact]
    public async Task InviteAsync_Success_InvitesCandidateAndGeneratesMagicLink()
    {
        // UTCID01 / Sheet: InviteAsync
        var svc = CreateService();
        var companyId = 1L;
        var userId = 1L;
        var poolId = 10L;
        var appId = 100L;

        var pool = new InterviewSlotPool { PoolId = poolId, JobId = 5L, Status = "Open", RoundNumber = 1 };
        _schedulingRepo.Setup(r => r.GetPoolByIdAsync(companyId, poolId)).ReturnsAsync(pool);
        _appRepo.Setup(r => r.GetByIdAsync(companyId, appId)).ReturnsAsync(new GP35.SRIS.Domain.Entities.Application { ApplicationId = appId, JobId = 5L });
        _schedulingRepo.Setup(r => r.HasActiveInviteInPoolAsync(companyId, poolId, appId)).ReturnsAsync(false);
        _schedulingRepo.Setup(r => r.HasConfirmedScheduleForRoundAsync(companyId, appId, 1)).ReturnsAsync(false);

        _schedulingRepo.Setup(r => r.InsertInviteScheduleAsync(companyId, It.IsAny<InterviewSchedule>())).ReturnsAsync(200L);
        _magicLink.Setup(m => m.IssueAsync(companyId, appId, "SCHEDULE", null))
            .ReturnsAsync(new MagicLinkIssued(1L, "issued-token-xyz", "SCHEDULE", DateTime.UtcNow.AddDays(7)));

        var dto = new InvitePoolDto { ApplicationIds = new List<long> { appId } };
        var result = await svc.InviteAsync(companyId, userId, poolId, dto);

        Assert.NotNull(result);
        Assert.Single(result.Invited);
        Assert.Equal(appId, result.Invited[0].ApplicationId);
        Assert.Equal("issued-token-xyz", result.Invited[0].MagicToken);
        _magicLink.Verify(m => m.IssueAsync(companyId, appId, "SCHEDULE", null), Times.Once);
    }

    [Fact]
    public async Task InviteAsync_CandidateAlreadyInvited_SkipsInvitation()
    {
        // UTCID02 / Sheet: InviteAsync
        var svc = CreateService();
        var companyId = 1L;
        var userId = 1L;
        var poolId = 10L;
        var appId = 100L;

        var pool = new InterviewSlotPool { PoolId = poolId, JobId = 5L, Status = "Open", RoundNumber = 1 };
        _schedulingRepo.Setup(r => r.GetPoolByIdAsync(companyId, poolId)).ReturnsAsync(pool);
        _appRepo.Setup(r => r.GetByIdAsync(companyId, appId)).ReturnsAsync(new GP35.SRIS.Domain.Entities.Application { ApplicationId = appId, JobId = 5L });
        _schedulingRepo.Setup(r => r.HasActiveInviteInPoolAsync(companyId, poolId, appId)).ReturnsAsync(true);

        var dto = new InvitePoolDto { ApplicationIds = new List<long> { appId } };
        var result = await svc.InviteAsync(companyId, userId, poolId, dto);

        Assert.NotNull(result);
        Assert.Empty(result.Invited);
        Assert.Single(result.Skipped);
        Assert.Equal(appId, result.Skipped[0].ApplicationId);
        Assert.Contains("Đã mời", result.Skipped[0].Reason);
    }
}
