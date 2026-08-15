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

/// <summary>
/// Đặt lịch phỏng vấn sau khi bỏ pool khung (docs Section 15 — viết lại 15/08/2026):
/// bộ phận nhân sự gọi điện thống nhất giờ rồi nhập buổi; hệ thống lo chống trùng + email.
/// </summary>
public class InterviewScheduleServiceTests
{
    private const long CompanyId = 1;
    private const long UserId = 9;
    private const long AppId = 100;
    private const long JobId = 5;

    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<ISchedulingRepo> _schedulingRepo = new();
    private readonly Mock<IEvaluationCriteriaRepo> _criteriaRepo = new();
    private readonly Mock<IUserRepo> _userRepo = new();
    private readonly Mock<IActivityLogRepo> _activityLogRepo = new();
    private readonly Mock<INotificationService> _notify = new();
    private readonly Mock<ILogger> _logger = new();

    private InterviewScheduleService CreateService(string appState = "INTERVIEW")
    {
        _logger.Setup(l => l.ForContext<InterviewScheduleService>()).Returns(_logger.Object);

        // Đặt lịch đòi job có tiêu chí ĐÃ DUYỆT (nếu không interviewer nhận phiếu chấm trống).
        _criteriaRepo
            .Setup(r => r.GetByJobAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<bool>(), It.IsAny<bool>()))
            .ReturnsAsync(new List<EvaluationCriteria>
            {
                new() { CriteriaId = 1, Name = "Tiêu chí mẫu", Weight = 1, MaxScore = 10 }
            });
        _appRepo.Setup(r => r.GetByIdAsync(CompanyId, AppId))
            .ReturnsAsync(new Domain.Entities.Application
            {
                ApplicationId = AppId, CompanyId = CompanyId, JobId = JobId, CurrentState = appState
            });
        _schedulingRepo.Setup(r => r.GetNextRoundNumberAsync(CompanyId, AppId)).ReturnsAsync(1);
        _schedulingRepo.Setup(r => r.ManualConfirmAsync(
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(), It.IsAny<IReadOnlyList<long>>(),
                It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<string?>(), It.IsAny<long?>()))
            .ReturnsAsync(555L);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_schedulingRepo.Object);
            s.AddSingleton(_criteriaRepo.Object);
            s.AddSingleton(_userRepo.Object);
            s.AddSingleton(_activityLogRepo.Object);
            s.AddSingleton(_notify.Object);
            s.AddSingleton(_logger.Object);
        });
        return new InterviewScheduleService(provider);
    }

    private static BookInterviewDto Dto(int daysAhead = 3) => new()
    {
        InterviewerIds = new List<long> { 7 },
        StartTime = DateTime.Now.AddDays(daysAhead)
    };

    [Fact]
    public async Task Book_HappyPath_CreatesSession_LogsAndNotifies()
    {
        var svc = CreateService();

        var scheduleId = await svc.BookAsync(CompanyId, UserId, AppId, Dto());

        Assert.Equal(555L, scheduleId);
        _activityLogRepo.Verify(r => r.InsertAsync(CompanyId,
            It.Is<ActivityLog>(l => l.Action == "INTERVIEW_SCHEDULED")), Times.Once);
        _notify.Verify(n => n.SendInterviewConfirmedAsync(CompanyId, AppId, It.IsAny<DateTime>()), Times.Once);
    }

    /// <summary>Nhân sự LÊN LỊCH, không CHỌN người — hồ sơ phải được Trưởng bộ phận duyệt trước.</summary>
    [Theory]
    [InlineData("NEW")]
    [InlineData("SCREENING")]
    public async Task Book_WhenApplicationNotApproved_Throws409(string state)
    {
        var svc = CreateService(appState: state);

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.BookAsync(CompanyId, UserId, AppId, Dto()));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        Assert.Contains("chưa được Trưởng bộ phận duyệt", ex.ErrorMessage);
        _schedulingRepo.Verify(r => r.ManualConfirmAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(), It.IsAny<IReadOnlyList<long>>(),
            It.IsAny<DateTime>(), It.IsAny<int>(), It.IsAny<string?>(), It.IsAny<long?>()), Times.Never);
    }

    [Fact]
    public async Task Book_PastTime_Throws400()
    {
        var svc = CreateService();

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.BookAsync(CompanyId, UserId, AppId, Dto(daysAhead: -1)));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task Book_WhenJobHasNoApprovedCriteria_Throws409()
    {
        var svc = CreateService();
        // Đè SAU CreateService(): Moq lấy setup đăng ký sau cùng.
        _criteriaRepo
            .Setup(r => r.GetByJobAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<bool>(), It.IsAny<bool>()))
            .ReturnsAsync(new List<EvaluationCriteria>());

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.BookAsync(CompanyId, UserId, AppId, Dto()));

        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    /// <summary>Nhân sự đã gọi điện, nhưng vẫn cần lưới an toàn: 1 người không ngồi 2 buổi sát nhau.</summary>
    [Fact]
    public async Task Book_WhenCandidateBusy_Throws409()
    {
        var svc = CreateService();
        _schedulingRepo.Setup(r => r.FindCandidateBusyAtAsync(
                CompanyId, AppId, It.IsAny<DateTime>(), It.IsAny<TimeSpan>(), It.IsAny<long>()))
            .ReturnsAsync(DateTime.Now.AddDays(3));

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.BookAsync(CompanyId, UserId, AppId, Dto()));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        Assert.Contains("Ứng viên đã có buổi", ex.ErrorMessage);
    }

    [Fact]
    public async Task Book_WhenInterviewerBusy_Throws409_WithTheirName()
    {
        var svc = CreateService();
        _schedulingRepo.Setup(r => r.FindBusyInterviewerAsync(
                CompanyId, It.IsAny<IReadOnlyList<long>>(), It.IsAny<DateTime>(),
                It.IsAny<TimeSpan>(), It.IsAny<long>()))
            .ReturnsAsync(new BusyInterviewer(7, DateTime.Now.AddDays(3)));
        _userRepo.Setup(r => r.GetNamesByIdsAsync(CompanyId, It.IsAny<IReadOnlyList<long>>()))
            .ReturnsAsync(new List<User> { new() { UserId = 7, FullName = "Lê Minh Đức" } });

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.BookAsync(CompanyId, UserId, AppId, Dto()));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        // Báo TÊN chứ không phải "#7": người nhận lỗi phải biết gọi lại cho ai.
        Assert.Contains("Lê Minh Đức", ex.ErrorMessage);
    }

    [Fact]
    public async Task Book_SameRoundTwice_Throws409()
    {
        var svc = CreateService();
        _schedulingRepo.Setup(r => r.HasConfirmedScheduleForRoundAsync(CompanyId, AppId, 1)).ReturnsAsync(true);

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.BookAsync(CompanyId, UserId, AppId, Dto()));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        Assert.Contains("vòng 1", ex.ErrorMessage);
    }

    [Fact]
    public async Task Book_RoundSkippingAhead_Throws400()
    {
        var svc = CreateService();
        var dto = Dto();
        dto.RoundNumber = 4;

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.BookAsync(CompanyId, UserId, AppId, dto));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
        Assert.Contains("vòng 1", ex.ErrorMessage);
    }

    // ===== Hủy buổi =====

    [Fact]
    public async Task Cancel_CancelsSession_AndNotifiesCandidate()
    {
        var svc = CreateService();
        _schedulingRepo.Setup(r => r.GetScheduleByIdAsync(CompanyId, 555L))
            .ReturnsAsync(new InterviewSchedule
            {
                ScheduleId = 555, ApplicationId = AppId, PoolId = 42, ConfirmedSlotId = 21, RoundNumber = 1
            });
        _schedulingRepo.Setup(r => r.GetSlotAsync(CompanyId, 21L))
            .ReturnsAsync(new InterviewSlot { SlotId = 21, StartTime = DateTime.Now.AddDays(2) });
        _schedulingRepo.Setup(r => r.CancelPoolAsync(CompanyId, 42L)).ReturnsAsync(true);

        await svc.CancelAsync(CompanyId, UserId, 555L, new CancelInterviewDto { Reason = "Sếp đi công tác" });

        _schedulingRepo.Verify(r => r.CancelPoolAsync(CompanyId, 42L), Times.Once);
        _notify.Verify(n => n.SendInterviewCancelledAsync(
            CompanyId, AppId, It.IsAny<DateTime?>(), "Sếp đi công tác"), Times.Once);
        _activityLogRepo.Verify(r => r.InsertAsync(CompanyId,
            It.Is<ActivityLog>(l => l.Action == "INTERVIEW_CANCELLED")), Times.Once);
    }

    [Fact]
    public async Task Cancel_AlreadyCancelled_Throws409()
    {
        var svc = CreateService();
        _schedulingRepo.Setup(r => r.GetScheduleByIdAsync(CompanyId, 555L))
            .ReturnsAsync(new InterviewSchedule { ScheduleId = 555, ApplicationId = AppId, PoolId = 42 });
        _schedulingRepo.Setup(r => r.CancelPoolAsync(CompanyId, 42L)).ReturnsAsync(false);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.CancelAsync(CompanyId, UserId, 555L, new CancelInterviewDto()));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        _notify.Verify(n => n.SendInterviewCancelledAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<DateTime?>(), It.IsAny<string?>()), Times.Never);
    }
}
