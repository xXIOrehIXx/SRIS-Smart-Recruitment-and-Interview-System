using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// ApplicationStateService (docs 5.8): forward-only + reject (reason tùy chọn) +
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
    private readonly Mock<IJobRepo> _jobRepo = new();

    /// <summary>
    /// Người đang thao tác. Mặc định Human Resource trên job KHÔNG gán DM -> guard "chỉ DM của job
    /// mới quyết tuyển" (cửa OFFER→HIRED/REJECTED) không chặn, các test cũ giữ nguyên hành vi.
    /// </summary>
    private readonly ContextDataStub _context = new() { UserId = UserId, Role = "Recruiter" };

    private ApplicationStateService CreateService(string currentState, int submittedScores = 0)
    {
        // Mock CÓ trạng thái: ghi state xong thì lần đọc sau phải thấy state mới, đúng như DB thật.
        // Cần cho AdvanceToAsync (đi nhiều bước liên tiếp) — mock trả state cố định sẽ báo lỗi giả.
        var state = currentState;

        _appRepo.Setup(r => r.GetByIdAsync(CompanyId, AppId))
            .ReturnsAsync(() => new Domain.Entities.Application
            {
                ApplicationId = AppId,
                CompanyId = CompanyId,
                JobId = 1,
                CurrentState = state
            });
        _appRepo.Setup(r => r.TransitionStateAsync(
                CompanyId, AppId, It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>()))
            .ReturnsAsync(1)
            .Callback<long, long, string, string?, DateTime, DateTime?, DateTime?>(
                (_, _, to, _, _, _, _) => state = to);
        _appRepo.Setup(r => r.CountSubmittedInterviewScoresAsync(CompanyId, AppId))
            .ReturnsAsync(submittedScores);

        // Job không gán DM (department_manager_id = null) = đường mặc định công ty nhỏ: ai cũng chốt được.
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "Test", Status = "Open" });

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_logRepo.Object);
            s.AddSingleton(_notify.Object);
            s.AddSingleton(_jobRepo.Object);
            s.AddSingleton<IContextData>(_context);
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

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    public async Task Reject_WithoutReason_Succeeds_AndPersistsNull(string? reason)
    {
        // Lý do loại là TÙY CHỌN: bỏ trống vẫn loại được, cột reject_reason nhận null
        // (không lưu chuỗi rỗng để dashboard "tại sao rớt" khỏi đếm nhầm nhóm rác).
        var service = CreateService("SCREENING");

        var result = await service.TransitionAsync(CompanyId, UserId, AppId, "REJECTED", reason);

        Assert.Equal("REJECTED", result.ToState);
        _appRepo.Verify(r => r.TransitionStateAsync(
            CompanyId, AppId, "REJECTED", null,
            It.IsAny<DateTime>(), It.IsAny<DateTime?>(), null), Times.Once);
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

    // ===== Quyết tuyển ở cửa OFFER: chỉ DM của job (5.14) =====

    /// <summary>Job gán DM khác -> người khác chốt OFFER→HIRED bị chặn.</summary>
    [Fact]
    public async Task Transition_OutOfOffer_ByOtherUser_Throws403()
    {
        var service = CreateService("OFFER");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "HIRED", null));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
    }

    [Fact]
    public async Task Transition_OutOfOffer_ByAssignedDepartmentManager_Succeeds()
    {
        var service = CreateService("OFFER");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = UserId });

        var result = await service.TransitionAsync(CompanyId, UserId, AppId, "HIRED", null);

        Assert.Equal("HIRED", result.ToState);
    }

    /// <summary>
    /// Ứng viên phản hồi offer đi qua magic link (ẩn danh, userId = 0) — KHÔNG được áp guard DM,
    /// nếu không offer đã ACCEPTED mà hồ sơ kẹt ở OFFER.
    /// </summary>
    [Fact]
    public async Task Transition_OutOfOffer_ByCandidateMagicLink_Succeeds()
    {
        var service = CreateService("OFFER");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });
        _context.UserId = 0;
        _context.Role = null;

        var result = await service.TransitionAsync(CompanyId, 0, AppId, "HIRED", null);

        Assert.Equal("HIRED", result.ToState);
    }

    [Fact]
    public async Task Transition_OutOfOffer_ByAdmin_Succeeds()
    {
        var service = CreateService("OFFER");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });
        _context.Role = "Admin";

        var result = await service.TransitionAsync(CompanyId, UserId, AppId, "HIRED", null);

        Assert.Equal("HIRED", result.ToState);
    }

    /// <summary>Guard chỉ áp ở cửa OFFER — các bước trước đó Human Resource vẫn đi bình thường.</summary>
    [Fact]
    public async Task Transition_BeforeOffer_NotAffectedByDecisionGuard()
    {
        var service = CreateService("SCREENING");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var result = await service.TransitionAsync(CompanyId, UserId, AppId, "INTERVIEW", null);

        Assert.Equal("INTERVIEW", result.ToState);
    }

    // ===== AdvanceToAsync: duyệt/chốt ở màn khác tự đẩy card, khỏi kéo Kanban =====

    [Fact]
    public async Task AdvanceTo_WalksEveryStep_AndLogsEachHop()
    {
        var service = CreateService("NEW");

        await service.AdvanceToAsync(CompanyId, UserId, AppId, "INTERVIEW");

        _appRepo.Verify(r => r.TransitionStateAsync(
            CompanyId, AppId, "SCREENING", null, It.IsAny<DateTime>(), null, null), Times.Once);
        _appRepo.Verify(r => r.TransitionStateAsync(
            CompanyId, AppId, "INTERVIEW", null, It.IsAny<DateTime>(), null, null), Times.Once);
    }

    [Fact]
    public async Task AdvanceTo_AlreadyAtOrPastTarget_DoesNothing()
    {
        var service = CreateService("OFFER");

        await service.AdvanceToAsync(CompanyId, UserId, AppId, "INTERVIEW");

        _appRepo.Verify(r => r.TransitionStateAsync(
            CompanyId, AppId, It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>()), Times.Never);
    }

    [Theory]
    [InlineData("HIRED")]
    [InlineData("REJECTED")]
    public async Task AdvanceTo_FromClosedState_Throws409(string from)
    {
        var service = CreateService(from);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.AdvanceToAsync(CompanyId, UserId, AppId, "INTERVIEW"));

        Assert.Equal("INVALID_TRANSITION", ex.ErrorCode);
    }

    // ---------- Khóa phiếu chấm phỏng vấn theo trạng thái hồ sơ ----------

    [Theory]
    [InlineData("OFFER")]
    [InlineData("HIRED")]
    [InlineData("REJECTED")]
    public void IsScoringLocked_AfterDecision_True(string state)
    {
        Assert.True(ApplicationStateMachine.IsScoringLocked(state));
        Assert.False(string.IsNullOrWhiteSpace(ApplicationStateMachine.ScoringLockReason(state)));
    }

    [Theory]
    [InlineData("NEW")]
    [InlineData("SCREENING")]
    [InlineData("INTERVIEW")]
    [InlineData(null)]
    public void IsScoringLocked_BeforeDecision_False(string? state)
    {
        // Phiếu đã SUBMITTED vẫn sửa được ở các state này — nộp chỉ mở blind, không chốt sổ.
        Assert.False(ApplicationStateMachine.IsScoringLocked(state));
        Assert.Null(ApplicationStateMachine.ScoringLockReason(state));
    }
}

/// <summary>IContextData sửa được trong test (Role/UserId đổi theo từng kịch bản).</summary>
internal sealed class ContextDataStub : IContextData
{
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string? FullName { get; set; }
    public string? SessionId { get; set; }
    public long UserId { get; set; }
    public string? UserName { get; set; }
    public string? Code { get; set; }
    public long CompanyId { get; set; }
    public string? Role { get; set; }
}
