using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Serilog;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class InterviewScoringServiceTests
{
    private readonly Mock<ISchedulingRepo> _schedulingRepo = new();
    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<IJobRepo> _jobRepo = new();
    private readonly Mock<ICandidateRepo> _candidateRepo = new();
    private readonly Mock<IEvaluationCriteriaRepo> _criteriaRepo = new();
    private readonly Mock<IInterviewScoreRepo> _scoreRepo = new();
    private readonly Mock<ILogger> _logger = new();

    private InterviewScoringService CreateService()
    {
        _logger.Setup(l => l.ForContext<InterviewScoringService>()).Returns(_logger.Object);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_schedulingRepo.Object);
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_jobRepo.Object);
            s.AddSingleton(_candidateRepo.Object);
            s.AddSingleton(_criteriaRepo.Object);
            s.AddSingleton(_scoreRepo.Object);
            s.AddSingleton(_logger.Object);
        });
        return new InterviewScoringService(provider);
    }

    [Fact]
    public async Task SubmitAsync_Should_Throw_If_Interviewer_Not_Assigned()
    {
        // Arrange
        var svc = CreateService();
        _schedulingRepo.Setup(r => r.IsInterviewerOnScheduleAsync(1L, 10L, 100L)).ReturnsAsync(false);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.SubmitAsync(1L, 100L, 10L));
        Assert.Equal("FORBIDDEN", ex.ErrorCode);
    }

    [Fact]
    public async Task SubmitAsync_Should_Submit_Sheet_If_All_Criteria_Scored()
    {
        // Arrange
        var svc = CreateService();
        _schedulingRepo.Setup(r => r.IsInterviewerOnScheduleAsync(1L, 10L, 100L)).ReturnsAsync(true);

        var schedule = new InterviewSchedule { ScheduleId = 10, ApplicationId = 5 };
        _schedulingRepo.Setup(r => r.GetScheduleByIdAsync(1L, 10L)).ReturnsAsync(schedule);
        
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 5, JobId = 2, CandidateId = 3 };
        _appRepo.Setup(r => r.GetByIdAsync(1L, 5L)).ReturnsAsync(app);
        
        var criteria = new List<EvaluationCriteria>
        {
            new EvaluationCriteria { CriteriaId = 1, Name = "Skill" },
            new EvaluationCriteria { CriteriaId = 2, Name = "Culture" }
        };
        _criteriaRepo.Setup(r => r.GetByJobAsync(1L, 2L, true)).ReturnsAsync(criteria);

        var scores = new List<InterviewScore>
        {
            new InterviewScore { CriteriaId = 1, Score = 8 },
            new InterviewScore { CriteriaId = 2, Score = 9 }
        };
        _scoreRepo.Setup(r => r.GetByScheduleAndInterviewerAsync(1L, 10L, 100L)).ReturnsAsync(scores);
        _schedulingRepo.Setup(r => r.GetPanelSizeAsync(1L, 10L)).ReturnsAsync(1);

        // Nộp phiếu = đưa ra kết luận: phải có đề xuất thì mới nộp được (V031).
        _scoreRepo.Setup(r => r.GetFeedbackAsync(1L, 10L, 100L)).ReturnsAsync(new InterviewFeedback
        {
            ScheduleId = 10,
            InterviewerId = 100,
            Recommendation = InterviewRecommendation.Hire,
            Summary = "Nền tảng chắc, giao tiếp tốt."
        });

        // Mock for BuildSheetFullAsync inner dependencies
        _jobRepo.Setup(r => r.GetByIdAsync(1L, 2L)).ReturnsAsync(new Job { Title = "Dev" });
        _candidateRepo.Setup(r => r.GetByIdAsync(1L, 3L)).ReturnsAsync(new Candidate { FullName = "Nam" });

        // Act
        var result = await svc.SubmitAsync(1L, 100L, 10L);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(10, result.ScheduleId);
        _scoreRepo.Verify(r => r.SubmitAsync(1L, 10L, 100L), Times.Once);
        _scoreRepo.Verify(r => r.SubmitFeedbackAsync(1L, 10L, 100L), Times.Once);
    }

    [Fact]
    public async Task SubmitAsync_Should_Throw_If_No_Recommendation_Written()
    {
        // Chấm đủ điểm nhưng không ghi kết luận -> màn quyết định của người quyết tuyển sẽ
        // trống trơn, nên chặn ngay ở cửa nộp phiếu.
        var svc = CreateService();
        _schedulingRepo.Setup(r => r.IsInterviewerOnScheduleAsync(1L, 10L, 100L)).ReturnsAsync(true);
        _schedulingRepo.Setup(r => r.GetScheduleByIdAsync(1L, 10L))
            .ReturnsAsync(new InterviewSchedule { ScheduleId = 10, ApplicationId = 5, RoundNumber = 1, Status = "CONFIRMED" });
        _appRepo.Setup(r => r.GetByIdAsync(1L, 5L))
            .ReturnsAsync(new GP35.SRIS.Domain.Entities.Application { ApplicationId = 5, JobId = 2, CandidateId = 3, CurrentState = "INTERVIEW" });
        _criteriaRepo.Setup(r => r.GetByJobAsync(1L, 2L, true)).ReturnsAsync(new List<EvaluationCriteria>
        {
            new EvaluationCriteria { CriteriaId = 1, Name = "Skill" }
        });
        _scoreRepo.Setup(r => r.GetByScheduleAndInterviewerAsync(1L, 10L, 100L)).ReturnsAsync(new List<InterviewScore>
        {
            new InterviewScore { CriteriaId = 1, Score = 8 }
        });
        _scoreRepo.Setup(r => r.GetFeedbackAsync(1L, 10L, 100L)).ReturnsAsync((InterviewFeedback?)null);

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.SubmitAsync(1L, 100L, 10L));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
        _scoreRepo.Verify(r => r.SubmitAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }
}
