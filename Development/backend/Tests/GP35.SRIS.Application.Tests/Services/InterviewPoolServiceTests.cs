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

    // ===== Số vòng: dãy liên tục do hệ thống đánh, không ai gõ tay =====

    /// <summary>1 khung hợp lệ ở tương lai — dùng chung cho các test mở pool.</summary>
    private static List<SlotInputDto> ValidSlots() => new()
    {
        new SlotInputDto { InterviewerIds = new List<long> { 7 }, StartTime = DateTime.Now.AddDays(3) }
    };

    private void SetupPoolsOfJob(params InterviewSlotPool[] pools) =>
        SetupPoolsOfJob(pools.Select(p => new PoolWithSlots(p, new List<InterviewSlot>())).ToArray());

    private void SetupPoolsOfJob(params PoolWithSlots[] pools)
    {
        _schedulingRepo
            .Setup(r => r.GetPoolsByJobAsync(1L, 5L))
            .ReturnsAsync(pools.ToList());

        // CreatePoolAsync đọc lại pool vừa tạo để dựng DTO trả về — stub đường đọc đó, nếu không
        // test chết ở khâu dựng DTO thay vì kiểm tra được luật số vòng.
        _schedulingRepo
            .Setup(r => r.GetSlotsByPoolAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<bool>()))
            .ReturnsAsync(new List<InterviewSlot>());
        _schedulingRepo
            .Setup(r => r.GetSchedulesByPoolAsync(It.IsAny<long>(), It.IsAny<long>()))
            .ReturnsAsync(new List<InterviewSchedule>());
        _userRepo
            .Setup(r => r.GetNamesByIdsAsync(It.IsAny<long>(), It.IsAny<IReadOnlyList<long>>()))
            .ReturnsAsync(new List<User>());
    }

    [Fact]
    public async Task CreatePoolAsync_Should_Default_To_Next_Round()
    {
        var svc = CreateService();
        SetupPoolsOfJob(new InterviewSlotPool { PoolId = 1, JobId = 5, RoundNumber = 2, Status = "CLOSED" });

        InterviewSlotPool? inserted = null;
        _schedulingRepo
            .Setup(r => r.InsertPoolWithSlotsAsync(1L, It.IsAny<InterviewSlotPool>(), It.IsAny<IEnumerable<InterviewSlot>>()))
            .Callback<long, InterviewSlotPool, IEnumerable<InterviewSlot>>((_, p, _) => inserted = p)
            .ReturnsAsync(99L);

        await svc.CreatePoolAsync(1L, 1L, 5L, new CreatePoolDto { Slots = ValidSlots() });

        Assert.Equal(3, inserted!.RoundNumber);
    }

    [Fact]
    public async Task CreatePoolAsync_Should_Reject_Round_That_Skips_Ahead()
    {
        var svc = CreateService();
        SetupPoolsOfJob(new InterviewSlotPool { PoolId = 1, JobId = 5, RoundNumber = 1, Status = "CLOSED" });

        var ex = await Assert.ThrowsAsync<BaseException>(() =>
            svc.CreatePoolAsync(1L, 1L, 5L, new CreatePoolDto { RoundNumber = 5, Slots = ValidSlots() }));

        Assert.Contains("tăng dần", ex.ErrorMessage);
        _schedulingRepo.Verify(
            r => r.InsertPoolWithSlotsAsync(It.IsAny<long>(), It.IsAny<InterviewSlotPool>(), It.IsAny<IEnumerable<InterviewSlot>>()),
            Times.Never);
    }

    [Fact]
    public async Task CreatePoolAsync_Should_Allow_Reopening_An_Existing_Round_And_Keep_Its_Name()
    {
        // Ứng viên nộp muộn vẫn phải phỏng vấn vòng 1 dù người khác đã sang vòng 2 — và phải
        // thấy đúng tên vòng 1 cũ, không phải một vòng 1 vô danh.
        var svc = CreateService();
        SetupPoolsOfJob(
            new InterviewSlotPool { PoolId = 2, JobId = 5, RoundNumber = 2, Status = "OPEN", Name = "Gặp giám đốc" },
            new InterviewSlotPool { PoolId = 1, JobId = 5, RoundNumber = 1, Status = "CLOSED", Name = "Sơ loại" });

        InterviewSlotPool? inserted = null;
        _schedulingRepo
            .Setup(r => r.InsertPoolWithSlotsAsync(1L, It.IsAny<InterviewSlotPool>(), It.IsAny<IEnumerable<InterviewSlot>>()))
            .Callback<long, InterviewSlotPool, IEnumerable<InterviewSlot>>((_, p, _) => inserted = p)
            .ReturnsAsync(99L);

        await svc.CreatePoolAsync(1L, 1L, 5L, new CreatePoolDto { RoundNumber = 1, Slots = ValidSlots() });

        Assert.Equal(1, inserted!.RoundNumber);
        Assert.Equal("Sơ loại", inserted.Name);
    }

    [Fact]
    public async Task CreatePoolAsync_Should_Reject_Slot_Earlier_Than_Previous_Round()
    {
        // Vòng 1 có khung muộn nhất ngày 21 -> vòng 2 mở khung ngày 19 là để ngỏ khả năng ứng
        // viên phỏng vấn vòng 2 trước khi vòng 1 của họ diễn ra.
        var svc = CreateService();
        var round1 = new InterviewSlotPool { PoolId = 1, JobId = 5, RoundNumber = 1, Status = "OPEN" };
        SetupPoolsOfJob(new PoolWithSlots(round1, new List<InterviewSlot>
        {
            new() { SlotId = 11, PoolId = 1, StartTime = DateTime.Now.AddDays(8), Status = "OPEN" }
        }));

        var dto = new CreatePoolDto
        {
            Slots = new List<SlotInputDto>
            {
                new() { InterviewerIds = new List<long> { 7 }, StartTime = DateTime.Now.AddDays(6) }
            }
        };

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.CreatePoolAsync(1L, 1L, 5L, dto));

        Assert.Contains("phải diễn ra sau vòng 1", ex.ErrorMessage);
        _schedulingRepo.Verify(
            r => r.InsertPoolWithSlotsAsync(It.IsAny<long>(), It.IsAny<InterviewSlotPool>(), It.IsAny<IEnumerable<InterviewSlot>>()),
            Times.Never);
    }

    [Fact]
    public async Task ManualConfirmAsync_Should_Reject_Round_That_Skips_Ahead()
    {
        var svc = CreateService();
        _appRepo.Setup(r => r.GetByIdAsync(1L, 100L))
            .ReturnsAsync(new GP35.SRIS.Domain.Entities.Application { ApplicationId = 100, JobId = 5 });
        // Ứng viên chưa phỏng vấn buổi nào -> buổi đầu tiên phải là vòng 1.
        _schedulingRepo.Setup(r => r.GetNextRoundNumberAsync(1L, 100L)).ReturnsAsync(1);

        var dto = new ManualConfirmDto
        {
            InterviewerIds = new List<long> { 7 },
            StartTime = DateTime.Now.AddDays(3),
            RoundNumber = 4
        };

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.ManualConfirmAsync(1L, 1L, 100L, dto));

        Assert.Contains("vòng 1", ex.ErrorMessage);
        _stateService.Verify(
            s => s.AdvanceToAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>()),
            Times.Never);
    }
}
