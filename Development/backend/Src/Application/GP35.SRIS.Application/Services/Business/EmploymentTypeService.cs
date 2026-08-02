using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.EmploymentType;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using EmploymentTypeEntity = GP35.SRIS.Domain.Entities.EmploymentType;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Danh mục hình thức làm việc (V027) — bản sao luật của DepartmentService vì cùng kiểu
/// tham chiếu bằng TÊN: đổi tên -> đồng bộ Job/RecruitmentRequest; xóa -> chặn khi còn
/// job dùng (gợi ý Inactive).
/// </summary>
public class EmploymentTypeService : BaseService<EmploymentTypeService>, IEmploymentTypeService
{
    private static readonly string[] ValidStatuses = { "Active", "Inactive" };

    private readonly IEmploymentTypeRepo _employmentTypeRepo;
    private readonly ILogger _logger;

    public EmploymentTypeService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _employmentTypeRepo = serviceProvider.GetRequiredService<IEmploymentTypeRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<EmploymentTypeService>();
    }

    public async Task<EmploymentTypeDto> CreateAsync(long companyId, EmploymentTypeInputDto dto)
    {
        var name = ValidateName(dto);
        if (await _employmentTypeRepo.NameExistsAsync(companyId, name))
            throw Conflict($"Hình thức làm việc '{name}' đã tồn tại.");

        var entity = new EmploymentTypeEntity
        {
            Name = name,
            Description = Clean(dto.Description),
            Status = NormalizeStatus(dto.Status)
        };
        var employmentTypeId = await _employmentTypeRepo.InsertAsync(companyId, entity);

        _logger.Information("EmploymentType: tạo hình thức id={EmploymentTypeId} '{Name}'.",
            employmentTypeId, name);

        return await GetByIdAsync(companyId, employmentTypeId);
    }

    public async Task<IReadOnlyList<EmploymentTypeDto>> GetListAsync(long companyId)
    {
        var rows = await _employmentTypeRepo.GetListAsync(companyId);
        return rows.Select(r => Map(r.EmploymentType, r.JobCount)).ToList();
    }

    public async Task<EmploymentTypeDto> GetByIdAsync(long companyId, long employmentTypeId)
    {
        var rows = await _employmentTypeRepo.GetListAsync(companyId);
        var row = rows.FirstOrDefault(r => r.EmploymentType.EmploymentTypeId == employmentTypeId)
            ?? throw NotFound($"Không tìm thấy hình thức làm việc (employment_type_id={employmentTypeId}).");
        return Map(row.EmploymentType, row.JobCount);
    }

    public async Task<EmploymentTypeDto> UpdateAsync(
        long companyId, long employmentTypeId, EmploymentTypeInputDto dto)
    {
        var name = ValidateName(dto);
        var entity = await _employmentTypeRepo.GetByIdAsync(companyId, employmentTypeId)
            ?? throw NotFound($"Không tìm thấy hình thức làm việc (employment_type_id={employmentTypeId}).");
        if (await _employmentTypeRepo.NameExistsAsync(companyId, name, exceptId: employmentTypeId))
            throw Conflict($"Hình thức làm việc '{name}' đã tồn tại.");

        var oldName = entity.Name;
        entity.Name = name;
        entity.Description = Clean(dto.Description);
        entity.Status = NormalizeStatus(dto.Status ?? entity.Status);
        entity.UpdatedAt = DateTime.UtcNow;
        await _employmentTypeRepo.SaveAsync();

        // Job/RecruitmentRequest lưu TÊN hình thức -> đổi tên phải đồng bộ, không thì mồ côi.
        if (!string.Equals(oldName, name, StringComparison.OrdinalIgnoreCase))
        {
            await _employmentTypeRepo.RenameReferencesAsync(companyId, oldName, name);
            _logger.Information("EmploymentType: đổi tên '{OldName}' -> '{Name}', đã đồng bộ Job/RecruitmentRequest.",
                oldName, name);
        }

        return await GetByIdAsync(companyId, employmentTypeId);
    }

    public async Task DeleteAsync(long companyId, long employmentTypeId)
    {
        var entity = await _employmentTypeRepo.GetByIdAsync(companyId, employmentTypeId)
            ?? throw NotFound($"Không tìm thấy hình thức làm việc (employment_type_id={employmentTypeId}).");

        var jobCount = await _employmentTypeRepo.CountJobsUsingAsync(companyId, entity.Name);
        if (jobCount > 0)
            throw Conflict($"Hình thức '{entity.Name}' đang có {jobCount} tin tuyển dụng — " +
                "đổi các tin sang hình thức khác hoặc chuyển trạng thái sang Inactive thay vì xóa.");

        await _employmentTypeRepo.DeleteAsync(entity);
        _logger.Information("EmploymentType: xóa hình thức id={EmploymentTypeId} '{Name}'.",
            employmentTypeId, entity.Name);
    }

    // ============================================================

    private static string ValidateName(EmploymentTypeInputDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw Bad("Tên hình thức làm việc không được để trống.");
        var name = dto.Name.Trim();
        if (name.Length > 100)
            throw Bad("Tên hình thức làm việc tối đa 100 ký tự.");
        return name;
    }

    private static string NormalizeStatus(string? status)
    {
        var s = (status ?? "Active").Trim();
        return ValidStatuses.FirstOrDefault(v => v.Equals(s, StringComparison.OrdinalIgnoreCase)) ?? "Active";
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static EmploymentTypeDto Map(EmploymentTypeEntity t, int jobCount) => new()
    {
        EmploymentTypeId = t.EmploymentTypeId,
        Name = t.Name,
        Description = t.Description,
        Status = t.Status,
        JobCount = jobCount,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
