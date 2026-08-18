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
    /// V045: duyệt vào vòng phỏng vấn có thể kèm danh sách người phỏng vấn DM chỉ định. Các test ở
    /// đây không truyền danh sách nào nên service không gọi tới — chỉ cần có mặt để dựng được service.
    /// </summary>
    private readonly Mock<IInterviewPanelService> _panel = new();

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
            s.AddSingleton(_panel.Object);
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
        _context.Role = RoleConstants.Director;   // cửa quyết tuyển là của Giám đốc (V043)

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "OFFER", null));

        Assert.Equal("INVALID_TRANSITION", ex.ErrorCode);
        Assert.Contains("G2", ex.ErrorMessage);
    }

    [Fact]
    public async Task InterviewToOffer_WithOneSubmittedScore_Passes()
    {
        var service = CreateService("INTERVIEW", submittedScores: 1);
        _context.Role = RoleConstants.Director;

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
        // Dùng chặng NEW để bài test này chỉ nói về LÝ DO, không dính tới chuyện ai được loại.
        var service = CreateService("NEW");

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

        // Ai được LOẠI ở từng chặng (siết 17/08/2026): NEW = nhân sự · SCREENING và INTERVIEW =
        // Trưởng bộ phận của vị trí · OFFER = Giám đốc.
        // Bài test này chỉ kiểm reason được lưu, nên mỗi ca vào vai đúng người rồi mới bấm.
        if (from == "OFFER")
        {
            _context.Role = RoleConstants.Director;
        }
        else if (from is "SCREENING" or "INTERVIEW")
        {
            _context.Role = RoleConstants.DepartmentManager;
            _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
                .ReturnsAsync(new Job
                {
                    JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open",
                    DepartmentManagerId = UserId
                });
        }

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
        _context.Role = RoleConstants.Director;

        await service.TransitionAsync(CompanyId, UserId, AppId, "HIRED", null);

        _notify.Verify(n => n.SendResultAsync(CompanyId, AppId, "HIRED"), Times.Once);
    }

    // ===== Quyết tuyển: chỉ GIÁM ĐỐC (5.14 — V043, chốt 15/08/2026) =====

    /// <summary>Nhân sự không chốt được kết quả ở bước Quyết định.</summary>
    [Fact]
    public async Task Transition_OutOfOffer_ByHumanResource_Throws403()
    {
        var service = CreateService("OFFER");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "HIRED", null));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
    }

    /// <summary>
    /// Trưởng bộ phận PHỤ TRÁCH vị trí cũng không đủ thẩm quyền tuyển — họ chỉ ĐỀ XUẤT.
    /// Đây là điều hội đồng chốt 15/08/2026; trước đó chính DM là người quyết ở cửa này.
    /// </summary>
    [Fact]
    public async Task InterviewToOffer_ByAssignedDepartmentManager_Throws403()
    {
        var service = CreateService("INTERVIEW", submittedScores: 1);
        _context.Role = RoleConstants.DepartmentManager;
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = UserId });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "OFFER", null));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
        Assert.Contains("Giám đốc", ex.ErrorMessage);
    }

    /// <summary>Giám đốc có phạm vi toàn công ty: không đối chiếu với DM của vị trí.</summary>
    [Fact]
    public async Task Transition_OutOfOffer_ByDirector_Succeeds()
    {
        var service = CreateService("OFFER");
        _context.Role = RoleConstants.Director;
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

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

    /// <summary>Sàng lọc là việc của Human Resource — cửa duyệt chỉ bắt đầu ở SCREENING→INTERVIEW.</summary>
    [Fact]
    public async Task Transition_NewToScreening_NotAffectedByDecisionGuard()
    {
        var service = CreateService("NEW");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var result = await service.TransitionAsync(CompanyId, UserId, AppId, "SCREENING", null);

        Assert.Equal("SCREENING", result.ToState);
    }

    // ===== Duyệt vào vòng phỏng vấn: chỉ DM của job (5.8, chốt 15/08/2026) =====

    /// <summary>Human Resource (hay DM phòng khác) không được tự đưa ứng viên vào vòng phỏng vấn.</summary>
    [Fact]
    public async Task ScreeningToInterview_ByOtherUser_Throws403()
    {
        var service = CreateService("SCREENING");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "INTERVIEW", null));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
        _appRepo.Verify(r => r.TransitionStateAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>()), Times.Never);
    }

    [Fact]
    public async Task ScreeningToInterview_ByAssignedDepartmentManager_Succeeds()
    {
        var service = CreateService("SCREENING");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = UserId });

        var result = await service.TransitionAsync(CompanyId, UserId, AppId, "INTERVIEW", null);

        Assert.Equal("INTERVIEW", result.ToState);
    }

    /// <summary>
    /// Job chưa gán DM: cửa OFFER rơi về Human Resource, nhưng cửa vào phỏng vấn thì KHÔNG —
    /// chặn và nói rõ thiếu người phụ trách, thay vì lặng lẽ cho Human Resource tự chọn người.
    /// </summary>
    [Fact]
    public async Task ScreeningToInterview_JobWithoutManager_Throws403()
    {
        var service = CreateService("SCREENING");

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "INTERVIEW", null));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
        Assert.Contains("chưa gán Trưởng bộ phận", ex.ErrorMessage);
    }

    [Fact]
    public async Task ScreeningToInterview_ByAdmin_Succeeds()
    {
        var service = CreateService("SCREENING");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });
        _context.Role = "Admin";

        var result = await service.TransitionAsync(CompanyId, UserId, AppId, "INTERVIEW", null);

        Assert.Equal("INTERVIEW", result.ToState);
    }

    // ===== Cửa LOẠI: cùng người gác với cửa duyệt ở mỗi chặng (siết 17/08/2026) =====
    //
    // Trước bản này mọi đường sang REJECTED đều không kiểm ai bấm, nên bộ phận nhân sự loại được
    // ứng viên một mình ở bất kỳ đâu. Hội đồng bảo vệ nêu đúng điểm đó: loại hồ sơ CHÍNH LÀ phê
    // duyệt hồ sơ, mà "nhân sự không được quyền phê duyệt hồ sơ ứng tuyển".

    /// <summary>Nhân sự KHÔNG được loại ứng viên đã vào bước sàng lọc — đó là cửa của Trưởng bộ phận.</summary>
    [Fact]
    public async Task RejectFromScreening_ByHumanResource_Throws403()
    {
        var service = CreateService("SCREENING");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.RejectAsync(CompanyId, UserId, AppId, "Chuyên môn chưa đạt"));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
        _appRepo.Verify(r => r.TransitionStateAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>()), Times.Never);
    }

    [Fact]
    public async Task RejectFromScreening_ByAssignedDepartmentManager_Succeeds()
    {
        var service = CreateService("SCREENING");
        _context.Role = RoleConstants.DepartmentManager;
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = UserId });

        var result = await service.RejectAsync(CompanyId, UserId, AppId, "Chuyên môn chưa đạt");

        Assert.Equal("REJECTED", result.ToState);
    }

    /// <summary>
    /// Sàng lọc vòng đầu vẫn là việc của nhân sự: loại hồ sơ trùng / nộp nhầm vị trí / thiếu yêu
    /// cầu cứng ở bước Hồ sơ mới KHÔNG cần Trưởng bộ phận. Siết cả chặng này là bắt DM đọc từng
    /// hồ sơ rác — đúng thứ sản phẩm định giải phóng cho họ.
    /// </summary>
    [Fact]
    public async Task RejectFromNew_ByHumanResource_Succeeds()
    {
        var service = CreateService("NEW");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var result = await service.RejectAsync(CompanyId, UserId, AppId, "Nộp nhầm vị trí");

        Assert.Equal("REJECTED", result.ToState);
    }

    /// <summary>
    /// ĐÓNG hồ sơ sau phỏng vấn là việc của người đã ngồi phỏng vấn (DM phụ trách vị trí),
    /// KHÔNG phải của Giám đốc. Bắt Giám đốc tự tay đóng từng hồ sơ trượt là tuyển 1 người trong
    /// 20 thì họ bấm 19 lần — và chẳng bảo vệ điều gì, vì DM vốn đã phủ quyết được bằng cách
    /// không gửi đề xuất. Ranh giới thật là TUYỂN, không phải LOẠI.
    /// </summary>
    [Fact]
    public async Task RejectFromInterview_ByAssignedDepartmentManager_Succeeds()
    {
        var service = CreateService("INTERVIEW");
        _context.Role = RoleConstants.DepartmentManager;
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = UserId });

        var result = await service.RejectAsync(CompanyId, UserId, AppId, "Phỏng vấn không đạt");

        Assert.Equal("REJECTED", result.ToState);
    }

    /// <summary>Nhưng nhân sự thì vẫn không — đó là điểm hội đồng nêu.</summary>
    [Fact]
    public async Task RejectFromInterview_ByHumanResource_Throws403()
    {
        var service = CreateService("INTERVIEW");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.RejectAsync(CompanyId, UserId, AppId, "Phỏng vấn không đạt"));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
    }

    [Fact]
    public async Task RejectFromInterview_ByDirector_Succeeds()
    {
        var service = CreateService("INTERVIEW");
        _context.Role = RoleConstants.Director;

        var result = await service.RejectAsync(CompanyId, UserId, AppId, "Phỏng vấn không đạt");

        Assert.Equal("REJECTED", result.ToState);
    }

    /// <summary>
    /// Giám đốc đi qua được cửa của Trưởng bộ phận (cấp trên, phạm vi toàn công ty) — kể cả trên
    /// vị trí do người khác phụ trách. Chặn họ ở đây chỉ tạo thế bí khi job đổi người giữa chừng.
    /// </summary>
    [Fact]
    public async Task RejectFromScreening_ByDirector_Succeeds()
    {
        var service = CreateService("SCREENING");
        _context.Role = RoleConstants.Director;
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var result = await service.RejectAsync(CompanyId, UserId, AppId, null);

        Assert.Equal("REJECTED", result.ToState);
    }

    /// <summary>Quyết TUYỂN vẫn chỉ của Giám đốc — DM đề xuất, không tự đẩy sang bước Quyết định.</summary>
    [Fact]
    public async Task InterviewToOffer_StillDirectorOnly()
    {
        var service = CreateService("INTERVIEW", submittedScores: 1);
        _context.Role = RoleConstants.DepartmentManager;
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = UserId });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.TransitionAsync(CompanyId, UserId, AppId, "OFFER", null));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
        Assert.Contains("ĐỀ XUẤT TUYỂN", ex.ErrorMessage);
    }

    /// <summary>Admin là superuser — công ty nhỏ chạy trọn luồng bằng một tài khoản.</summary>
    [Fact]
    public async Task RejectFromScreening_ByAdmin_Succeeds()
    {
        var service = CreateService("SCREENING");
        _context.Role = "Admin";
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var result = await service.RejectAsync(CompanyId, UserId, AppId, null);

        Assert.Equal("REJECTED", result.ToState);
    }

    /// <summary>
    /// Ứng viên TỪ CHỐI thư mời: OFFER→REJECTED nhưng đi bằng cờ isCandidateAnswer, không phải
    /// quyết định của người trong công ty. Siết cửa loại không được chặn nhầm đường này —
    /// chặn là ứng viên bấm "từ chối" trong email thì hệ thống báo 403.
    /// </summary>
    [Fact]
    public async Task RejectFromOffer_AsCandidateAnswer_BypassesGate()
    {
        var service = CreateService("OFFER");
        _context.Role = RoleConstants.HumanResource;

        var result = await service.TransitionAsync(
            CompanyId, UserId, AppId, "REJECTED", "Ứng viên từ chối thư mời nhận việc.",
            isCandidateAnswer: true);

        Assert.Equal("REJECTED", result.ToState);
    }

    // ===== AdvanceToAsync: duyệt/chốt ở màn khác tự đẩy card, khỏi kéo Kanban =====

    [Fact]
    public async Task AdvanceTo_WalksEveryStep_AndLogsEachHop()
    {
        var service = CreateService("NEW");
        // Chặng NEW→SCREENING→INTERVIEW đi qua cửa duyệt -> người đẩy phải là DM của job.
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = UserId });

        await service.AdvanceToAsync(CompanyId, UserId, AppId, "INTERVIEW");

        _appRepo.Verify(r => r.TransitionStateAsync(
            CompanyId, AppId, "SCREENING", null, It.IsAny<DateTime>(), null, null), Times.Once);
        _appRepo.Verify(r => r.TransitionStateAsync(
            CompanyId, AppId, "INTERVIEW", null, It.IsAny<DateTime>(), null, null), Times.Once);
    }

    /// <summary>
    /// Chặng bị chặn ở nấc SAU thì không được đi nấc TRƯỚC: hồ sơ nhảy sang SCREENING rồi mới
    /// báo 403 là người dùng thấy state đổi trong khi việc họ bấm thất bại.
    /// </summary>
    [Fact]
    public async Task AdvanceTo_BlockedMidPath_MovesNothing()
    {
        var service = CreateService("NEW");
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job { JobId = 1, CompanyId = CompanyId, Title = "T", Status = "Open", DepartmentManagerId = 999 });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.AdvanceToAsync(CompanyId, UserId, AppId, "INTERVIEW"));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
        _appRepo.Verify(r => r.TransitionStateAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<DateTime?>()), Times.Never);
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
