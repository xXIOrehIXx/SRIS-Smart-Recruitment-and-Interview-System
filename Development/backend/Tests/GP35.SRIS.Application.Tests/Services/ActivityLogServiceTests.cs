using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Repos;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class ActivityLogServiceTests
{
    private const long CompanyId = 1L;
    private const long ApplicationId = 100L;

    private readonly Mock<IActivityLogRepo> _logRepo = new();

    private ActivityLogService CreateService()
    {
        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_logRepo.Object);
        });
        return new ActivityLogService(provider);
    }

    [Fact]
    public async Task GetHistory_ValidIdMatchingRecords_ReturnsList()
    {
        // UTCID01: Valid identifier matching records
        var svc = CreateService();
        var mockLogs = new List<ActivityLogRow>
        {
            new(
                LogId: 1L,
                UserId: 10L,
                ActorEmail: "hr@sris.com",
                Action: "TRANSITION",
                FromState: "NEW",
                ToState: "APPROVED",
                Detail: "Approved by HR",
                CreatedAt: DateTime.UtcNow
            )
        };

        _logRepo.Setup(r => r.GetByApplicationAsync(CompanyId, ApplicationId))
            .ReturnsAsync(mockLogs);

        var result = await svc.GetHistoryAsync(CompanyId, ApplicationId);

        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("hr@sris.com", result[0].ActorEmail);
        Assert.Equal("Approved by HR", result[0].Detail);
    }

    [Fact]
    public async Task GetHistory_NoMatchingRecords_ReturnsEmptyList()
    {
        // UTCID02: Valid identifier with no matching records
        var svc = CreateService();

        _logRepo.Setup(r => r.GetByApplicationAsync(CompanyId, ApplicationId))
            .ReturnsAsync(new List<ActivityLogRow>());

        var result = await svc.GetHistoryAsync(CompanyId, ApplicationId);

        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetHistory_InvalidOrBoundaryId_ReturnsEmptyList()
    {
        // UTCID03: Invalid / boundary identifier (e.g. 0 or negative)
        var svc = CreateService();
        long invalidAppId = 0L;

        _logRepo.Setup(r => r.GetByApplicationAsync(CompanyId, invalidAppId))
            .ReturnsAsync(new List<ActivityLogRow>());

        var result = await svc.GetHistoryAsync(CompanyId, invalidAppId);

        Assert.NotNull(result);
        Assert.Empty(result);
    }
}
