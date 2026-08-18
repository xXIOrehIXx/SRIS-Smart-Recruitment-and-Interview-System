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
            // Tin đăng (Status mặc định Open) bắt buộc có người phụ trách — xem test dưới.
            DepartmentManagerId = 55,
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

    /// <summary>
    /// Đăng tin mà không có người phụ trách = hồ sơ nộp về sẽ kẹt ở Sàng lọc, vì cửa duyệt vào
    /// vòng phỏng vấn là của Trưởng bộ phận (5.8). Chặn ngay lúc đăng, đừng để lộ ra sau 2 tuần.
    /// </summary>
    [Fact]
    public async Task CreateAsync_Published_Without_DepartmentManager_Should_Throw()
    {
        var svc = CreateService();
        var dto = new JobCreateDto { Title = "Software Engineer", Status = "Open" };

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.CreateAsync(1L, 100L, dto));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
        Assert.Contains("Trưởng bộ phận phụ trách", ex.ErrorMessage);
        _jobRepo.Verify(r => r.InsertAsync(It.IsAny<long>(), It.IsAny<Job>()), Times.Never);
    }

    /// <summary>Bản NHÁP không ép: đang soạn dở còn chưa biết giao cho ai.</summary>
    [Fact]
    public async Task CreateAsync_Draft_Without_DepartmentManager_Should_Succeed()
    {
        var svc = CreateService();
        var dto = new JobCreateDto { Title = "Software Engineer", Status = "Draft" };

        _jobRepo.Setup(r => r.InsertAsync(1L, It.IsAny<Job>()))
            .Callback<long, Job>((_, job) => job.JobId = 11)
            .ReturnsAsync(11L);
        _jobRepo.Setup(r => r.GetByIdAsync(1L, 11)).ReturnsAsync(new Job { JobId = 11, Title = "Software Engineer" });
        _jobRepo.Setup(r => r.GetRequirementsAsync(1L, 11)).ReturnsAsync(new List<JobRequirement>());
        _jobRepo.Setup(r => r.GetBenefitsAsync(1L, 11)).ReturnsAsync(new List<JobBenefit>());

        var result = await svc.CreateAsync(1L, 100L, dto);

        Assert.Equal(11, result.JobId);
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
