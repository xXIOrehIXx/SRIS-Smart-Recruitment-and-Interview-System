using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
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
/// Đề xuất tuyển (docs 5.14 — V043): DM đề xuất, GIÁM ĐỐC quyết. Duyệt đề xuất là đường
/// DUY NHẤT đẩy hồ sơ INTERVIEW→OFFER trong luồng bình thường.
/// </summary>
public class HiringProposalServiceTests
{
    private const long CompanyId = 6;
    private const long DmUserId = 13;
    private const long DirectorUserId = 21;
    private const long AppId = 100;
    private const long JobId = 5;
    private const long ProposalId = 77;

    private readonly Mock<IHiringProposalRepo> _proposalRepo = new();
    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<IJobRepo> _jobRepo = new();
    private readonly Mock<IActivityLogRepo> _logRepo = new();
    private readonly Mock<IApplicationStateService> _stateService = new();
    private readonly ContextDataStub _context = new()
    {
        UserId = DmUserId, CompanyId = CompanyId, Role = RoleConstants.DepartmentManager
    };

    private HiringProposalService CreateService(
        string appState = "INTERVIEW", int submittedScores = 1, long? jobManagerId = DmUserId)
    {
        _appRepo.Setup(r => r.GetByIdAsync(CompanyId, AppId))
            .ReturnsAsync(new Domain.Entities.Application
            {
                ApplicationId = AppId, CompanyId = CompanyId, JobId = JobId, CurrentState = appState
            });
        _appRepo.Setup(r => r.CountSubmittedInterviewScoresAsync(CompanyId, AppId))
            .ReturnsAsync(submittedScores);
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, It.IsAny<long>()))
            .ReturnsAsync(new Job
            {
                JobId = JobId, CompanyId = CompanyId, Title = "Bếp chính", Status = "Open",
                DepartmentManagerId = jobManagerId
            });

        // Service đọc lại phiếu qua GetListAsync để trả DTO (kèm tên ứng viên/vị trí).
        _proposalRepo.Setup(r => r.GetListAsync(CompanyId, It.IsAny<string?>()))
            .ReturnsAsync(() => new List<HiringProposalRow>
            {
                new(CurrentProposal, "Ngô Thị Lan", null, "Trần Văn Nam", "nam@example.com",
                    JobId, "Bếp chính", "Bếp", "INTERVIEW")
            });
        _proposalRepo.Setup(r => r.InsertAsync(CompanyId, It.IsAny<HiringProposal>()))
            .ReturnsAsync(ProposalId)
            .Callback<long, HiringProposal>((_, p) =>
            {
                p.ProposalId = ProposalId;
                CurrentProposal = p;
            });

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_proposalRepo.Object);
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_jobRepo.Object);
            s.AddSingleton(_logRepo.Object);
            s.AddSingleton(_stateService.Object);
            s.AddSingleton<IContextData>(_context);
        });
        return new HiringProposalService(provider);
    }

    /// <summary>Phiếu "đang nằm trong DB" — mock đọc/ghi cùng trỏ vào đây.</summary>
    private HiringProposal CurrentProposal { get; set; } = new()
    {
        ProposalId = ProposalId, CompanyId = CompanyId, ApplicationId = AppId, Status = "PENDING"
    };

    // ===== DM đề xuất =====

    [Fact]
    public async Task Create_ByAssignedManager_SavesPendingProposal()
    {
        var service = CreateService();

        var result = await service.CreateAsync(CompanyId, DmUserId, AppId,
            new CreateProposalDto { Note = "Tay nghề chắc, hợp ca tối", ProposedSalary = 15_000_000 });

        Assert.Equal("PENDING", result.Status);
        _proposalRepo.Verify(r => r.InsertAsync(CompanyId, It.Is<HiringProposal>(p =>
            p.ApplicationId == AppId && p.Status == "PENDING" && p.ProposedSalary == 15_000_000)), Times.Once);
        _logRepo.Verify(r => r.InsertAsync(CompanyId, It.Is<ActivityLog>(l => l.Action == "HIRING_PROPOSED")), Times.Once);
    }

    /// <summary>
    /// V053: phiếu KHÔNG có mức lương thì Giám đốc chẳng có điều khoản nào để duyệt, và thư mời
    /// lại rơi về cảnh nhân sự tự điền lương — chặn ngay lúc gửi đề xuất.
    /// </summary>
    [Fact]
    public async Task Create_WithoutSalary_Throws400()
    {
        var service = CreateService();

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.CreateAsync(
            CompanyId, DmUserId, AppId, new CreateProposalDto { Note = "Tay nghề chắc" }));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
        _proposalRepo.Verify(r => r.InsertAsync(It.IsAny<long>(), It.IsAny<HiringProposal>()), Times.Never);
    }

    [Fact]
    public async Task Create_ByOtherManager_Throws403()
    {
        var service = CreateService(jobManagerId: 999);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.CreateAsync(CompanyId, DmUserId, AppId, new CreateProposalDto()));

        Assert.Equal("FORBIDDEN", ex.ErrorCode);
        _proposalRepo.Verify(r => r.InsertAsync(It.IsAny<long>(), It.IsAny<HiringProposal>()), Times.Never);
    }

    [Theory]
    [InlineData("SCREENING")]
    [InlineData("OFFER")]
    public async Task Create_WhenApplicationNotAtInterview_Throws409(string state)
    {
        var service = CreateService(appState: state);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.CreateAsync(CompanyId, DmUserId, AppId, new CreateProposalDto()));

        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    /// <summary>
    /// Cùng ngưỡng với guard G2: đề xuất khi chưa ai chấm thì Giám đốc bấm duyệt sẽ vấp guard
    /// lúc chuyển trạng thái — báo ngay từ lúc đề xuất mới đúng chỗ người dùng sửa được.
    /// </summary>
    [Fact]
    public async Task Create_WithoutSubmittedScore_Throws409()
    {
        var service = CreateService(submittedScores: 0);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.CreateAsync(CompanyId, DmUserId, AppId, new CreateProposalDto()));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        Assert.Contains("phiếu chấm", ex.ErrorMessage);
    }

    [Fact]
    public async Task Create_WhenAnotherProposalPending_Throws409()
    {
        var service = CreateService();
        _proposalRepo.Setup(r => r.GetPendingByApplicationAsync(CompanyId, AppId))
            .ReturnsAsync(new HiringProposal { ProposalId = 1, ApplicationId = AppId, Status = "PENDING" });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.CreateAsync(CompanyId, DmUserId, AppId, new CreateProposalDto()));

        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    // ===== Giám đốc quyết =====

    [Fact]
    public async Task Decide_Approve_MovesApplicationToOffer_AndKeepsProposedTerms()
    {
        var service = CreateService();
        CurrentProposal = new HiringProposal
        {
            ProposalId = ProposalId, CompanyId = CompanyId, ApplicationId = AppId, Status = "PENDING",
            ProposedSalary = 15_000_000
        };
        _proposalRepo.Setup(r => r.GetByIdAsync(CompanyId, ProposalId)).ReturnsAsync(() => CurrentProposal);
        _context.Role = RoleConstants.Director;

        var result = await service.DecideAsync(CompanyId, DirectorUserId, ProposalId,
            new DecideProposalDto { Approve = true, Note = "Đồng ý tuyển" });

        Assert.Equal("APPROVED", result.Status);
        // Duyệt = gật đầu ĐÚNG mức trên phiếu — không có ô lương thứ hai để ghi đè (V053).
        Assert.Equal(15_000_000, CurrentProposal.ProposedSalary);
        Assert.Equal(DirectorUserId, CurrentProposal.DecidedBy);
        _stateService.Verify(s => s.TransitionAsync(
            CompanyId, DirectorUserId, AppId, "OFFER", "Đồng ý tuyển", false), Times.Once);
    }

    /// <summary>
    /// V053: Giám đốc không gõ đè mức lương khác nữa — cửa mặc cả là "chưa duyệt KÈM lý do".
    /// Không ghi lý do thì phiếu quay về mà Trưởng bộ phận không biết phải sửa gì.
    /// </summary>
    [Fact]
    public async Task Decide_Reject_WithoutNote_Throws400()
    {
        var service = CreateService();
        _proposalRepo.Setup(r => r.GetByIdAsync(CompanyId, ProposalId)).ReturnsAsync(() => CurrentProposal);
        _context.Role = RoleConstants.Director;

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.DecideAsync(
            CompanyId, DirectorUserId, ProposalId, new DecideProposalDto { Approve = false, Note = "  " }));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
        Assert.Equal("PENDING", CurrentProposal.Status);
    }

    /// <summary>Không duyệt KHÁC loại ứng viên: hồ sơ ở lại bước Phỏng vấn.</summary>
    [Fact]
    public async Task Decide_Reject_DoesNotTouchApplicationState()
    {
        var service = CreateService();
        CurrentProposal = new HiringProposal
        {
            ProposalId = ProposalId, CompanyId = CompanyId, ApplicationId = AppId, Status = "PENDING"
        };
        _proposalRepo.Setup(r => r.GetByIdAsync(CompanyId, ProposalId)).ReturnsAsync(() => CurrentProposal);
        _context.Role = RoleConstants.Director;

        var result = await service.DecideAsync(CompanyId, DirectorUserId, ProposalId,
            new DecideProposalDto { Approve = false, Note = "Chờ so với ứng viên tuần sau" });

        Assert.Equal("REJECTED", result.Status);
        _stateService.Verify(s => s.TransitionAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(),
            It.IsAny<string?>(), It.IsAny<bool>()), Times.Never);
    }

    [Fact]
    public async Task Decide_AlreadyDecided_Throws409()
    {
        var service = CreateService();
        _proposalRepo.Setup(r => r.GetByIdAsync(CompanyId, ProposalId))
            .ReturnsAsync(new HiringProposal
            {
                ProposalId = ProposalId, ApplicationId = AppId, Status = "APPROVED"
            });
        _context.Role = RoleConstants.Director;

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.DecideAsync(
            CompanyId, DirectorUserId, ProposalId, new DecideProposalDto { Approve = true }));

        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    /// <summary>
    /// Chuyển trạng thái hỏng (guard G2, quyền...) thì phiếu phải CÒN PENDING để bấm lại —
    /// phiếu ghi APPROVED mà hồ sơ đứng ở cột Phỏng vấn là trạng thái không ai gỡ được.
    /// </summary>
    [Fact]
    public async Task Decide_Approve_WhenTransitionFails_LeavesProposalPending()
    {
        var service = CreateService();
        CurrentProposal = new HiringProposal
        {
            ProposalId = ProposalId, CompanyId = CompanyId, ApplicationId = AppId, Status = "PENDING"
        };
        _proposalRepo.Setup(r => r.GetByIdAsync(CompanyId, ProposalId)).ReturnsAsync(() => CurrentProposal);
        _context.Role = RoleConstants.Director;
        _stateService.Setup(s => s.TransitionAsync(
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(),
                It.IsAny<string?>(), It.IsAny<bool>()))
            .ThrowsAsync(new BaseException("G2") { ErrorCode = "INVALID_TRANSITION", ErrorMessage = "G2" });

        await Assert.ThrowsAsync<BaseException>(() => service.DecideAsync(
            CompanyId, DirectorUserId, ProposalId, new DecideProposalDto { Approve = true }));

        Assert.Equal("PENDING", CurrentProposal.Status);
        _proposalRepo.Verify(r => r.SaveAsync(), Times.Never);
    }
}
