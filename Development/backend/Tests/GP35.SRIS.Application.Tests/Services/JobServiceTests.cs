using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Services;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class JobServiceTests
{
    private readonly Mock<IJobRepo> _jobRepo = new();
    private readonly Mock<IDepartmentRepo> _departmentRepo = new();

    private JobService CreateService()
    {
        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_jobRepo.Object);
            s.AddSingleton(_departmentRepo.Object);
        });
        return new JobService(provider);
    }

    [Fact]
    public async Task CreateAsync_Should_Create_Job_And_Save_Requirements_Benefits()
    {
        // Arrange
        var svc = CreateService();
        var companyId = 1L;
        var createdBy = 100L;
        var dto = new JobCreateDto
        {
            Title = "Software Engineer",
            Requirements = new List<string> { "C#", "SQL" },
            Benefits = new List<string> { "Insurance" }
        };

        _jobRepo.Setup(r => r.InsertAsync(companyId, It.IsAny<Job>()))
            .Callback<long, Job>((cId, job) => job.JobId = 10)
            .ReturnsAsync(10L);

        _jobRepo.Setup(r => r.GetByIdAsync(companyId, 10))
            .ReturnsAsync(new Job { JobId = 10, Title = "Software Engineer" });
        _jobRepo.Setup(r => r.GetRequirementsAsync(companyId, 10))
            .ReturnsAsync(new List<JobRequirement>());
        _jobRepo.Setup(r => r.GetBenefitsAsync(companyId, 10))
            .ReturnsAsync(new List<JobBenefit>());

        // Act
        var result = await svc.CreateAsync(companyId, createdBy, dto);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(10, result.JobId);
        _jobRepo.Verify(r => r.InsertAsync(companyId, It.Is<Job>(j => j.Title == "Software Engineer")), Times.Once);
        _jobRepo.Verify(r => r.ReplaceRequirementsAsync(companyId, 10, dto.Requirements), Times.Once);
        _jobRepo.Verify(r => r.ReplaceBenefitsAsync(companyId, 10, dto.Benefits), Times.Once);
    }

    [Fact]
    public async Task UpdateAsync_With_EmptyTitle_Should_Throw_BadException()
    {
        // Arrange
        var svc = CreateService();
        var dto = new JobUpdateDto { Title = "   " };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.UpdateAsync(1L, 10L, dto));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task UpdateAsync_Should_Update_Existing_Job()
    {
        // Arrange
        var svc = CreateService();
        var dto = new JobUpdateDto { Title = "Updated Title", JdText = "New JD" };
        var existingJob = new Job { JobId = 10, Title = "Old Title" };

        _jobRepo.Setup(r => r.GetByIdAsync(1L, 10L)).ReturnsAsync(existingJob);
        _jobRepo.Setup(r => r.GetRequirementsAsync(1L, 10L)).ReturnsAsync(new List<JobRequirement>());
        _jobRepo.Setup(r => r.GetBenefitsAsync(1L, 10L)).ReturnsAsync(new List<JobBenefit>());

        // Act
        var result = await svc.UpdateAsync(1L, 10L, dto);

        // Assert
        Assert.NotNull(result);
        _jobRepo.Verify(r => r.UpdateExtendedAsync(1L, 10L, It.Is<Job>(j => j.Title == "Updated Title")), Times.Once);
    }

    [Fact]
    public async Task GetByIdAsync_Should_Return_JobDto()
    {
        // Arrange
        var svc = CreateService();
        var existingJob = new Job { JobId = 10, Title = "Test Job" };
        _jobRepo.Setup(r => r.GetByIdAsync(1L, 10L)).ReturnsAsync(existingJob);
        _jobRepo.Setup(r => r.GetRequirementsAsync(1L, 10L)).ReturnsAsync(new List<JobRequirement>());
        _jobRepo.Setup(r => r.GetBenefitsAsync(1L, 10L)).ReturnsAsync(new List<JobBenefit>());

        // Act
        var result = await svc.GetByIdAsync(1L, 10L);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Test Job", result.Title);
    }

    [Fact]
    public async Task GetByIdAsync_Should_Throw_NotFoundException_If_Not_Exist()
    {
        // Arrange
        var svc = CreateService();
        _jobRepo.Setup(r => r.GetByIdAsync(1L, 10L)).ReturnsAsync((Job)null!);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.GetByIdAsync(1L, 10L));
        Assert.Equal("NOT_FOUND", ex.ErrorCode);
    }
}
