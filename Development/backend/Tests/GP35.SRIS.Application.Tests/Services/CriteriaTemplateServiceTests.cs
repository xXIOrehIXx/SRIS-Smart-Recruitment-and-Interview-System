using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class CriteriaTemplateServiceTests
{
    private const long CompanyId = 1L;

    private readonly Mock<ICriteriaTemplateRepo> _templateRepo = new();
    private readonly Mock<IEvaluationCriteriaRepo> _criteriaRepo = new();

    private CriteriaTemplateService CreateService()
    {
        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_templateRepo.Object);
            s.AddSingleton(_criteriaRepo.Object);
        });
        return new CriteriaTemplateService(provider);
    }

    [Fact]
    public async Task Create_ValidDto_ReturnsCreatedTemplate()
    {
        // UTCID01: Happy path
        var svc = CreateService();
        var dto = new CriteriaTemplateInputDto
        {
            Name = "Template Name",
            Description = "Description",
            Items = new List<CriteriaTemplateItemInputDto>
            {
                new() { Name = "Crit 1", Weight = 1.5m, MaxScore = 10 }
            }
        };

        _templateRepo.Setup(r => r.InsertWithItemsAsync(CompanyId, It.IsAny<CriteriaTemplate>(), It.IsAny<List<CriteriaTemplateItem>>()))
            .ReturnsAsync(10L);

        _templateRepo.Setup(r => r.GetByIdAsync(CompanyId, 10L))
            .ReturnsAsync(new CriteriaTemplateWithItems(
                new CriteriaTemplate { TemplateId = 10L, Name = "Template Name", Description = "Description", Active = true },
                new List<CriteriaTemplateItem> { new() { ItemId = 100L, Name = "Crit 1", Weight = 1.5m, MaxScore = 10, DisplayOrder = 0 } }
            ));

        var result = await svc.CreateAsync(CompanyId, dto);

        Assert.NotNull(result);
        Assert.Equal(10L, result.TemplateId);
        Assert.Equal("Template Name", result.Name);
        Assert.Single(result.Items);
    }

    [Fact]
    public async Task Create_NullOrEmptyName_ThrowsBadRequest()
    {
        // UTCID02: Required parameters cannot be null or empty
        var svc = CreateService();
        var dto = new CriteriaTemplateInputDto
        {
            Name = " ",
            Items = new List<CriteriaTemplateItemInputDto>
            {
                new() { Name = "Crit 1", Weight = 1.5m, MaxScore = 10 }
            }
        };

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.CreateAsync(CompanyId, dto));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task Create_DuplicateTemplateName_ThrowsConflict()
    {
        // UTCID03: Duplicate entity constraint violation (mocked DB throw)
        var svc = CreateService();
        var dto = new CriteriaTemplateInputDto
        {
            Name = "Duplicate Template",
            Items = new List<CriteriaTemplateItemInputDto>
            {
                new() { Name = "Crit 1", Weight = 1.5m, MaxScore = 10 }
            }
        };

        _templateRepo.Setup(r => r.InsertWithItemsAsync(CompanyId, It.IsAny<CriteriaTemplate>(), It.IsAny<List<CriteriaTemplateItem>>()))
            .ThrowsAsync(new BaseException("Entity with specified key already exists.") { ErrorCode = "CONFLICT" });

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.CreateAsync(CompanyId, dto));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task Create_BoundaryValues_ReturnsCreatedTemplate()
    {
        // UTCID04: Boundary values for weight and maxScore
        var svc = CreateService();
        var dto = new CriteriaTemplateInputDto
        {
            Name = new string('A', 255), // Max length name
            Description = "Boundary weight test",
            Items = new List<CriteriaTemplateItemInputDto>
            {
                new() { Name = "Min Bound Crit", Weight = 0.01m, MaxScore = 0.1m }
            }
        };

        _templateRepo.Setup(r => r.InsertWithItemsAsync(CompanyId, It.IsAny<CriteriaTemplate>(), It.IsAny<List<CriteriaTemplateItem>>()))
            .ReturnsAsync(20L);

        _templateRepo.Setup(r => r.GetByIdAsync(CompanyId, 20L))
            .ReturnsAsync(new CriteriaTemplateWithItems(
                new CriteriaTemplate { TemplateId = 20L, Name = new string('A', 255), Description = "Boundary weight test", Active = true },
                new List<CriteriaTemplateItem> { new() { ItemId = 200L, Name = "Min Bound Crit", Weight = 0.01m, MaxScore = 0.1m, DisplayOrder = 0 } }
            ));

        var result = await svc.CreateAsync(CompanyId, dto);

        Assert.NotNull(result);
        Assert.Equal(20L, result.TemplateId);
        Assert.Equal(0.01m, result.Items[0].Weight);
        Assert.Equal(0.1m, result.Items[0].MaxScore);
    }

    [Fact]
    public async Task Task_GetAll_MatchingRecords_ReturnsList()
    {
        // UTCID01: Happy path matching records
        var svc = CreateService();
        var mockTemplates = new List<CriteriaTemplate>
        {
            new() { TemplateId = 1L, Name = "Template 1", Description = "Desc 1", Active = true }
        };
        var mockCounts = new Dictionary<long, int> { { 1L, 3 } };

        _templateRepo.Setup(r => r.GetAllAsync(CompanyId, false)).ReturnsAsync(mockTemplates);
        _templateRepo.Setup(r => r.GetItemCountsAsync(CompanyId)).ReturnsAsync(mockCounts);

        var result = await svc.GetAllAsync(CompanyId, includeInactive: true);

        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Template 1", result[0].Name);
        Assert.Equal(3, result[0].ItemCount);
    }

    [Fact]
    public async Task Task_GetAll_NoMatchingRecords_ReturnsEmptyList()
    {
        // UTCID02: No matching records
        var svc = CreateService();

        _templateRepo.Setup(r => r.GetAllAsync(CompanyId, false)).ReturnsAsync(new List<CriteriaTemplate>());
        _templateRepo.Setup(r => r.GetItemCountsAsync(CompanyId)).ReturnsAsync(new Dictionary<long, int>());

        var result = await svc.GetAllAsync(CompanyId, includeInactive: true);

        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task Task_GetAll_InvalidCompanyId_ReturnsEmptyList()
    {
        // UTCID03: Invalid company ID (0 or negative)
        var svc = CreateService();
        long invalidCompanyId = 0L;

        _templateRepo.Setup(r => r.GetAllAsync(invalidCompanyId, false)).ReturnsAsync(new List<CriteriaTemplate>());
        _templateRepo.Setup(r => r.GetItemCountsAsync(invalidCompanyId)).ReturnsAsync(new Dictionary<long, int>());

        var result = await svc.GetAllAsync(invalidCompanyId, includeInactive: true);

        Assert.NotNull(result);
        Assert.Empty(result);
    }
}
