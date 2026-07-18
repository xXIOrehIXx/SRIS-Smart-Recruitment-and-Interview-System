using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>Thư viện tiêu chí mẫu cấp company + áp khuôn vào job (Việc 12, xem 5.7).</summary>
public class CriteriaTemplateService : BaseService<CriteriaTemplateService>, ICriteriaTemplateService
{
    private readonly ICriteriaTemplateRepo _templateRepo;
    private readonly IEvaluationCriteriaRepo _criteriaRepo;

    public CriteriaTemplateService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _templateRepo = serviceProvider.GetRequiredService<ICriteriaTemplateRepo>();
        _criteriaRepo = serviceProvider.GetRequiredService<IEvaluationCriteriaRepo>();
    }

    public async Task<CriteriaTemplateDto> CreateAsync(long companyId, CriteriaTemplateInputDto dto)
    {
        ValidateHeader(dto.Name);
        var items = BuildItems(dto.Items);

        var template = new CriteriaTemplate { Name = dto.Name.Trim(), Description = dto.Description?.Trim() };
        var id = await _templateRepo.InsertWithItemsAsync(companyId, template, items);

        return await GetByIdOrThrowAsync(companyId, id);
    }

    public async Task<IReadOnlyList<CriteriaTemplateSummaryDto>> GetAllAsync(
        long companyId, bool includeInactive = false)
    {
        var templates = await _templateRepo.GetAllAsync(companyId, activeOnly: !includeInactive);
        var counts = await _templateRepo.GetItemCountsAsync(companyId);

        return templates.Select(t => new CriteriaTemplateSummaryDto
        {
            TemplateId = t.TemplateId,
            Name = t.Name,
            Description = t.Description,
            Active = t.Active,
            ItemCount = counts.TryGetValue(t.TemplateId, out var c) ? c : 0
        }).ToList();
    }

    public async Task<CriteriaTemplateDto?> GetByIdAsync(long companyId, long templateId)
    {
        var found = await _templateRepo.GetByIdAsync(companyId, templateId);
        return found is null ? null : Map(found);
    }

    public async Task<CriteriaTemplateDto> UpdateAsync(
        long companyId, long templateId, CriteriaTemplateUpdateDto dto)
    {
        ValidateHeader(dto.Name);
        var items = BuildItems(dto.Items);

        var ok = await _templateRepo.UpdateWithItemsAsync(
            companyId, templateId, dto.Name.Trim(), dto.Description?.Trim(), dto.Active, items);
        if (!ok)
            throw NotFound($"Không tìm thấy khuôn tiêu chí (template_id={templateId}).");

        return await GetByIdOrThrowAsync(companyId, templateId);
    }

    public Task<bool> DeactivateAsync(long companyId, long templateId) =>
        _templateRepo.DeactivateAsync(companyId, templateId);

    public async Task<IReadOnlyList<CriteriaDto>> ApplyToJobAsync(long companyId, long templateId, long jobId)
    {
        var found = await _templateRepo.GetByIdAsync(companyId, templateId)
            ?? throw NotFound($"Không tìm thấy khuôn tiêu chí (template_id={templateId}).");

        if (found.Items.Count == 0)
            throw Bad("Khuôn chưa có dòng tiêu chí nào — không có gì để áp.");

        // 1. Dọn record cũ cùng tên (cả DRAFT lẫn APPROVED — chỉ xóa nếu name trùng tên khuôn,
        //    không trùng thì giữ nguyên tuyệt đối).
        var names = found.Items.Select(i => i.Name.Trim()).Distinct().ToList();
        await _criteriaRepo.DeleteByJobAndNamesAsync(companyId, jobId, names);

        // 2. Clone từng dòng thành EvaluationCriteria mới.
        var created = new List<CriteriaDto>();
        foreach (var item in found.Items.OrderBy(i => i.DisplayOrder).ThenBy(i => i.ItemId))
        {
            var entity = new EvaluationCriteria
            {
                JobId = jobId,
                Name = item.Name,
                Weight = item.Weight,
                MaxScore = item.MaxScore,
                Active = true,
                Status = CriteriaStatus.Draft
            };
            entity.CriteriaId = await _criteriaRepo.InsertAsync(companyId, entity);

            created.Add(new CriteriaDto
            {
                CriteriaId = entity.CriteriaId,
                JobId = jobId,
                Name = entity.Name,
                Weight = entity.Weight,
                MaxScore = entity.MaxScore,
                Active = true
            });
        }
        return created;
    }

    // ============================================================

    private async Task<CriteriaTemplateDto> GetByIdOrThrowAsync(long companyId, long templateId)
    {
        var found = await _templateRepo.GetByIdAsync(companyId, templateId)
            ?? throw NotFound($"Không tìm thấy khuôn tiêu chí (template_id={templateId}).");
        return Map(found);
    }

    private static List<CriteriaTemplateItem> BuildItems(List<CriteriaTemplateItemInputDto>? items)
    {
        if (items is null || items.Count == 0)
            throw Bad("Khuôn phải có ít nhất 1 dòng tiêu chí.");

        var result = new List<CriteriaTemplateItem>();
        var order = 0;
        foreach (var i in items)
        {
            if (string.IsNullOrWhiteSpace(i.Name))
                throw Bad("Tên tiêu chí không được để trống.");
            if (i.Weight <= 0)
                throw Bad("Trọng số (weight) phải > 0.");
            if (i.MaxScore <= 0)
                throw Bad("Điểm tối đa (maxScore) phải > 0.");

            result.Add(new CriteriaTemplateItem
            {
                Name = i.Name.Trim(),
                Weight = i.Weight,
                MaxScore = i.MaxScore,
                DisplayOrder = order++
            });
        }
        return result;
    }

    private static void ValidateHeader(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw Bad("Tên khuôn không được để trống.");
    }

    private static CriteriaTemplateDto Map(CriteriaTemplateWithItems found) => new()
    {
        TemplateId = found.Template.TemplateId,
        Name = found.Template.Name,
        Description = found.Template.Description,
        Active = found.Template.Active,
        Items = found.Items.Select(i => new CriteriaTemplateItemDto
        {
            ItemId = i.ItemId,
            Name = i.Name,
            Weight = i.Weight,
            MaxScore = i.MaxScore,
            DisplayOrder = i.DisplayOrder
        }).ToList()
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
