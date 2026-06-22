using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>CRUD tiêu chí chấm per-job (5.7).</summary>
public class EvaluationCriteriaService : BaseService<EvaluationCriteriaService>, IEvaluationCriteriaService
{
    private readonly IEvaluationCriteriaRepo _criteriaRepo;

    public EvaluationCriteriaService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _criteriaRepo = serviceProvider.GetRequiredService<IEvaluationCriteriaRepo>();
    }

    public async Task<CriteriaDto> CreateAsync(long companyId, long jobId, CriteriaInputDto dto)
    {
        Validate(dto.Name, dto.Weight, dto.MaxScore);

        var entity = new EvaluationCriteria
        {
            JobId = jobId,
            Name = dto.Name.Trim(),
            Weight = dto.Weight,
            MaxScore = dto.MaxScore,
            Active = true
        };
        var id = await _criteriaRepo.InsertAsync(companyId, entity);
        entity.CriteriaId = id;
        return Map(entity);
    }

    public async Task<IReadOnlyList<CriteriaDto>> GetByJobAsync(long companyId, long jobId, bool includeInactive = false)
    {
        var list = await _criteriaRepo.GetByJobAsync(companyId, jobId, activeOnly: !includeInactive);
        return list.Select(Map).ToList();
    }

    public async Task<CriteriaDto> UpdateAsync(long companyId, long criteriaId, CriteriaUpdateDto dto)
    {
        Validate(dto.Name, dto.Weight, dto.MaxScore);

        var existing = await _criteriaRepo.GetByIdAsync(companyId, criteriaId)
            ?? throw NotFound($"Không tìm thấy tiêu chí (criteria_id={criteriaId}).");

        await _criteriaRepo.UpdateAsync(companyId, criteriaId, dto.Name.Trim(), dto.Weight, dto.MaxScore, dto.Active);

        return new CriteriaDto
        {
            CriteriaId = criteriaId,
            JobId = existing.JobId,
            Name = dto.Name.Trim(),
            Weight = dto.Weight,
            MaxScore = dto.MaxScore,
            Active = dto.Active
        };
    }

    // ============================================================

    private static void Validate(string? name, decimal weight, decimal maxScore)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw Bad("Tên tiêu chí không được để trống.");
        if (weight <= 0)
            throw Bad("Trọng số (weight) phải > 0.");
        if (maxScore <= 0)
            throw Bad("Điểm tối đa (maxScore) phải > 0.");
    }

    private static CriteriaDto Map(EvaluationCriteria c) => new()
    {
        CriteriaId = c.CriteriaId,
        JobId = c.JobId,
        Name = c.Name,
        Weight = c.Weight,
        MaxScore = c.MaxScore,
        Active = c.Active
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
