using GP35.SRIS.Application.Contracts.Dtos.CareerSite;
using GP35.SRIS.Application.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Lib.Services.Ai;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Contracts.Dtos.Business.Cv;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;
using GP35.SRIS.Domain.Shared.Exceptions;
using Serilog;

namespace GP35.SRIS.Application.Tests.Services;

public class CareerSiteServiceTests
{
    private readonly Mock<ICompanyRepo> _companyRepo = new();
    private readonly Mock<IJobRepo> _jobRepo = new();
    private readonly Mock<ICvIntakeService> _cvIntake = new();
    private readonly Mock<IPdfTextExtractor> _pdfExtractor = new();
    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<INotificationService> _notification = new();
    private readonly Mock<ILogger> _logger = new();

    private CareerSiteService CreateService()
    {
        _logger.Setup(l => l.ForContext<CareerSiteService>()).Returns(_logger.Object);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_companyRepo.Object);
            s.AddSingleton(_jobRepo.Object);
            s.AddSingleton(_cvIntake.Object);
            s.AddSingleton(_pdfExtractor.Object);
            s.AddSingleton(_magicLink.Object);
            s.AddSingleton(_notification.Object);
            s.AddSingleton(_logger.Object);
        });
        return new CareerSiteService(provider);
    }

    [Fact]
    public async Task ListOpenJobs_ValidCompanyWithOpenJobs_ReturnsOpenJobsList()
    {
        var service = CreateService();
        var companyId = 1L;
        var jobs = new List<Job>
        {
            new Job { JobId = 101L, Title = "Open Job 1", Status = "Open", CompanyId = companyId },
            new Job { JobId = 102L, Title = "Closed Job", Status = "Closed", CompanyId = companyId },
            new Job { JobId = 103L, Title = "Open Job 2", Status = "open", CompanyId = companyId }
        };

        _jobRepo.Setup(r => r.GetListByCompanyAsync(companyId)).ReturnsAsync(jobs);
        _jobRepo.Setup(r => r.GetRequirementsAsync(companyId, It.IsAny<long>())).ReturnsAsync(new List<JobRequirement>());
        _jobRepo.Setup(r => r.GetBenefitsAsync(companyId, It.IsAny<long>())).ReturnsAsync(new List<JobBenefit>());

        var result = await service.ListOpenJobsAsync(companyId);

        Assert.NotNull(result);
        var resultList = result.ToList();
        Assert.Equal(2, resultList.Count);
        Assert.Contains(resultList, j => j.JobId == 101L);
        Assert.Contains(resultList, j => j.JobId == 103L);
    }

    [Fact]
    public async Task ListOpenJobs_NoMatchingRecords_ReturnsEmptyList()
    {
        var service = CreateService();
        var companyId = 1L;
        var jobs = new List<Job>
        {
            new Job { JobId = 102L, Title = "Closed Job", Status = "Closed", CompanyId = companyId }
        };

        _jobRepo.Setup(r => r.GetListByCompanyAsync(companyId)).ReturnsAsync(jobs);

        var result = await service.ListOpenJobsAsync(companyId);

        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task ListOpenJobs_InvalidOrBoundaryCompanyId_ReturnsEmptyList()
    {
        var service = CreateService();
        _jobRepo.Setup(r => r.GetListByCompanyAsync(0L)).ReturnsAsync(new List<Job>());
        var resultZero = await service.ListOpenJobsAsync(0L);
        Assert.NotNull(resultZero);
        Assert.Empty(resultZero);
    }

    // ===== ApplyAsync =====

    [Fact]
    public async Task Apply_Success_SavesCvAndIssuesMagicLink()
    {
        var service = CreateService();
        var companyId = 1L;
        var jobId = 10L;
        var fileBytes = new byte[] { 0x25, 0x50, 0x44, 0x46 }; // %PDF header mock

        _jobRepo.Setup(r => r.GetByIdAsync(companyId, jobId))
            .ReturnsAsync(new Job { JobId = jobId, Status = "Open" });
        _pdfExtractor.Setup(p => p.Extract(fileBytes))
            .Returns(new PdfExtractResult(PdfKind.HasText, "Candidate CV content", 1, 20));
        _cvIntake.Setup(c => c.UploadCvAsync(companyId, jobId, "Nguyen Van A", "a@b.com", "0901234567", "cv.pdf", "application/pdf", fileBytes))
            .ReturnsAsync(new CvUploadResultDto { Status = "RECEIVED", ApplicationId = 100L });
        _magicLink.Setup(m => m.IssueAsync(companyId, 100L, "STATUS", It.IsAny<TimeSpan>()))
            .ReturnsAsync(new MagicLinkIssued(1L, "status-token", "STATUS", DateTime.UtcNow.AddDays(30)));

        var result = await service.ApplyAsync(companyId, jobId, "Nguyen Van A", "a@b.com", "0901234567", "cv.pdf", "application/pdf", fileBytes);

        Assert.NotNull(result);
        Assert.Equal(100L, result.ApplicationId);
        _magicLink.Verify(m => m.IssueAsync(companyId, 100L, "STATUS", It.IsAny<TimeSpan>()), Times.Once);
    }

    [Fact]
    public async Task Apply_EmptyRequiredFields_Throws400()
    {
        var service = CreateService();
        var fileBytes = new byte[] { 1, 2, 3 };

        // Empty Name
        var ex1 = await Assert.ThrowsAsync<BaseException>(() => service.ApplyAsync(1L, 10L, "  ", "a@b.com", "090", "cv.pdf", "pdf", fileBytes));
        Assert.Equal("BAD_REQUEST", ex1.ErrorCode);

        // Empty Email
        var ex2 = await Assert.ThrowsAsync<BaseException>(() => service.ApplyAsync(1L, 10L, "A", "", "090", "cv.pdf", "pdf", fileBytes));
        Assert.Equal("BAD_REQUEST", ex2.ErrorCode);
    }

    [Fact]
    public async Task Apply_JobClosedOrNotFound_Throws404()
    {
        var service = CreateService();
        var fileBytes = new byte[] { 1, 2, 3 };

        _jobRepo.Setup(r => r.GetByIdAsync(1L, 10L)).ReturnsAsync((Job?)null);

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.ApplyAsync(1L, 10L, "Nguyen Van A", "a@b.com", "0901234567", "cv.pdf", "pdf", fileBytes));
        Assert.Equal("NOT_FOUND", ex.ErrorCode);
    }

    [Fact]
    public async Task Apply_InvalidPdf_Throws400()
    {
        var service = CreateService();
        var fileBytes = new byte[] { 9, 9, 9 };

        _jobRepo.Setup(r => r.GetByIdAsync(1L, 10L)).ReturnsAsync(new Job { JobId = 10L, Status = "Open" });
        _pdfExtractor.Setup(p => p.Extract(fileBytes)).Throws(new System.Exception("Corrupted PDF"));

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.ApplyAsync(1L, 10L, "Nguyen Van A", "a@b.com", "0901234567", "cv.pdf", "pdf", fileBytes));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task Apply_ScanPdfWithoutText_Throws400()
    {
        var service = CreateService();
        var fileBytes = new byte[] { 1, 2, 3 };

        _jobRepo.Setup(r => r.GetByIdAsync(1L, 10L)).ReturnsAsync(new Job { JobId = 10L, Status = "Open" });
        _pdfExtractor.Setup(p => p.Extract(fileBytes)).Returns(new PdfExtractResult(PdfKind.NeedsManualEdit, "", 1, 0));

        var ex = await Assert.ThrowsAsync<BaseException>(() => service.ApplyAsync(1L, 10L, "Nguyen Van A", "a@b.com", "0901234567", "cv.pdf", "pdf", fileBytes));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }
}
