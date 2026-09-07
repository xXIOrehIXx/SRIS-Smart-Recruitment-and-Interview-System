using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Ai;
using GP35.SRIS.Lib.Services.Excel;
using GP35.SRIS.Storage;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// Xếp ứng viên theo mức phù hợp CV↔JD (V046) — hai nửa của cùng một tính năng:
/// chấm HÀNG LOẠT cho cả vị trí, rồi ĐỌC điểm đó lên card Kanban.
///
/// <para>
/// Ranh giới phải giữ nguyên: chấm điểm không đụng <c>current_state</c>. Ở đây điều đó thể hiện
/// bằng việc <see cref="CvScreeningService"/> không hề có <c>IApplicationStateService</c> trong
/// danh sách phụ thuộc — thêm được vào là test này không dựng nổi service nữa.
/// </para>
/// </summary>
public class CvScreeningRankingTests
{
    private const long CompanyId = 6;
    private const long JobId = 5;
    private const long UserId = 13;

    private readonly Mock<ICvScreeningRepo> _screeningRepo = new();
    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<ICvDocumentRepo> _cvRepo = new();
    private readonly Mock<IJobRepo> _jobRepo = new();
    private readonly Mock<ICvScreeningClient> _client = new();
    private readonly Mock<IFileStorageService> _storage = new();
    private readonly Mock<IPdfTextExtractor> _pdf = new();

    private readonly ContextDataStub _context = new()
    {
        UserId = UserId, CompanyId = CompanyId, Role = RoleConstants.HumanResource
    };

    /// <summary>1 card trên bảng, chỉ khai những trường bài test quan tâm.</summary>
    private static ApplicationBoardRow Row(
        long appId, string state, string? screeningStatus = null, int? fit = null, string? decision = null)
        => new(appId, appId + 1000, $"Ứng viên {appId}", $"uv{appId}@example.com",
            state, appId + 500, DateTime.UtcNow, screeningStatus, fit, decision);

    private CvScreeningService CreateService(IReadOnlyList<ApplicationBoardRow> board, string? jdText = "Nấu ăn ca tối")
    {
        _jobRepo.Setup(r => r.GetByIdAsync(CompanyId, JobId))
            .ReturnsAsync(new Job { JobId = JobId, CompanyId = CompanyId, Title = "Bếp chính", JdText = jdText });
        _jobRepo.Setup(r => r.GetRequirementsAsync(CompanyId, JobId))
            .ReturnsAsync(new List<JobRequirement>());

        _appRepo.Setup(r => r.GetBoardByJobAsync(CompanyId, JobId, It.IsAny<BoardSort>()))
            .ReturnsAsync(board);

        _screeningRepo.Setup(r => r.EnqueueAsync(
                CompanyId, It.IsAny<long>(), JobId, It.IsAny<long>(), UserId))
            .ReturnsAsync(new CvScreening { CompanyId = CompanyId, Status = ScreeningStatus.Pending });

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_screeningRepo.Object);
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_cvRepo.Object);
            s.AddSingleton(_jobRepo.Object);
            s.AddSingleton(_client.Object);
            s.AddSingleton(_storage.Object);
            s.AddSingleton(_pdf.Object);
            s.AddSingleton<IContextData>(_context);
        });
        return new CvScreeningService(provider);
    }

    // ===== Chấm hàng loạt cho 1 vị trí =====

    [Fact]
    public async Task RequestJobScreening_OnlyQueuesCandidatesStillBeingScreened()
    {
        // Hồ sơ đã qua vòng sàng lọc không cần chấm lại: chấm điểm là để CHỌN đọc trước,
        // mà người đang phỏng vấn thì đã được chọn rồi.
        var service = CreateService(new[]
        {
            Row(1, ApplicationState.New),
            Row(2, ApplicationState.Screening),
            Row(3, ApplicationState.Interview),
            Row(4, ApplicationState.Hired),
            Row(5, ApplicationState.Rejected)
        });

        var result = await service.RequestJobScreeningAsync(CompanyId, JobId, UserId);

        Assert.Equal(2, result.Queued);
        Assert.Equal(2, result.TotalCandidates);
        _screeningRepo.Verify(r => r.EnqueueAsync(CompanyId, 1, JobId, It.IsAny<long>(), UserId), Times.Once);
        _screeningRepo.Verify(r => r.EnqueueAsync(CompanyId, 2, JobId, It.IsAny<long>(), UserId), Times.Once);
        _screeningRepo.Verify(r => r.EnqueueAsync(CompanyId, 3, JobId, It.IsAny<long>(), UserId), Times.Never);
    }

    [Fact]
    public async Task RequestJobScreening_SkipsRowsAlreadyRunning()
    {
        // EnqueueAsync reset dòng về PENDING — gọi lên một lượt đang chạy dở là cướp việc
        // của worker và bắt nó chạy lại từ đầu.
        var service = CreateService(new[]
        {
            Row(1, ApplicationState.New, ScreeningStatus.Pending),
            Row(2, ApplicationState.Screening, ScreeningStatus.Running),
            Row(3, ApplicationState.New)
        });

        var result = await service.RequestJobScreeningAsync(CompanyId, JobId, UserId);

        Assert.Equal(1, result.Queued);
        Assert.Equal(2, result.SkippedRunning);
        _screeningRepo.Verify(r => r.EnqueueAsync(CompanyId, 3, JobId, It.IsAny<long>(), UserId), Times.Once);
        _screeningRepo.Verify(
            r => r.EnqueueAsync(CompanyId, It.IsIn<long>(1, 2), JobId, It.IsAny<long>(), UserId), Times.Never);
    }

    [Fact]
    public async Task RequestJobScreening_SkipsFinishedRowsUnlessRescreenAsked()
    {
        var board = new[]
        {
            Row(1, ApplicationState.Screening, ScreeningStatus.Done, 82, ScreeningDecision.Proceed),
            Row(2, ApplicationState.New)
        };

        var service = CreateService(board);
        var normal = await service.RequestJobScreeningAsync(CompanyId, JobId, UserId);

        Assert.Equal(1, normal.Queued);
        Assert.Equal(1, normal.SkippedDone);

        // Sửa tin tuyển dụng xong thì điểm cũ đối chiếu với một JD khác — so với nhau không
        // còn công bằng, nên phải chấm lại được cả bảng.
        var rescreen = await service.RequestJobScreeningAsync(CompanyId, JobId, UserId, rescreenDone: true);

        Assert.Equal(2, rescreen.Queued);
        Assert.Equal(0, rescreen.SkippedDone);
    }

    [Fact]
    public async Task RequestJobScreening_EmptyJd_Throws400WithoutQueueing()
    {
        var service = CreateService(new[] { Row(1, ApplicationState.New) }, jdText: null);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => service.RequestJobScreeningAsync(CompanyId, JobId, UserId));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
        _screeningRepo.Verify(
            r => r.EnqueueAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(),
                It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    // ===== Đọc điểm lên card =====

    [Fact]
    public async Task Board_CarriesScreeningResultOntoCards()
    {
        var appRepo = new Mock<IApplicationRepo>();
        appRepo.Setup(r => r.GetBoardByJobAsync(CompanyId, JobId, BoardSort.Fit))
            .ReturnsAsync(new[]
            {
                Row(1, ApplicationState.Screening, ScreeningStatus.Done, 82, ScreeningDecision.Proceed),
                Row(2, ApplicationState.New)
            });

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(appRepo.Object);
            s.AddSingleton(new Mock<IJobRepo>().Object);
            s.AddSingleton(new Mock<ICompanyRepo>().Object);
            s.AddSingleton(new Mock<ICandidateExcelExporter>().Object);
            s.AddSingleton<IContextData>(_context);
        });
        var service = new ApplicationQueryService(provider);

        var board = await service.GetBoardByJobAsync(CompanyId, JobId, BoardSort.Fit);

        Assert.Equal("fit", board.Sort);

        var scored = board.Applications.Single(a => a.ApplicationId == 1);
        Assert.Equal(82, scored.FitScore);
        Assert.Equal(ScreeningDecision.Proceed, scored.ScreeningDecision);

        // Chưa phân tích -> null, KHÔNG phải 0. Trả 0 là đẩy hồ sơ chưa ai đọc xuống đáy
        // ngang với hồ sơ đã đọc và thấy không hợp.
        var unscored = board.Applications.Single(a => a.ApplicationId == 2);
        Assert.Null(unscored.FitScore);
        Assert.Null(unscored.ScreeningStatus);
    }

    [Fact]
    public async Task Board_DefaultsToRecentOrder()
    {
        var appRepo = new Mock<IApplicationRepo>();
        appRepo.Setup(r => r.GetBoardByJobAsync(CompanyId, JobId, It.IsAny<BoardSort>()))
            .ReturnsAsync(Array.Empty<ApplicationBoardRow>());

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(appRepo.Object);
            s.AddSingleton(new Mock<IJobRepo>().Object);
            s.AddSingleton(new Mock<ICompanyRepo>().Object);
            s.AddSingleton(new Mock<ICandidateExcelExporter>().Object);
            s.AddSingleton<IContextData>(_context);
        });

        await new ApplicationQueryService(provider).GetBoardByJobAsync(CompanyId, JobId);

        // Các màn khác (đặt lịch, offer) gọi không kèm sort — chúng phải giữ nguyên thứ tự cũ.
        appRepo.Verify(r => r.GetBoardByJobAsync(CompanyId, JobId, BoardSort.Recent), Times.Once);
    }
}
