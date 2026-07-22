using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Department;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using DepartmentEntity = GP35.SRIS.Domain.Entities.Department;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Danh mục phòng ban (V022). Job/RecruitmentRequest tham chiếu bằng TÊN nên:
/// đổi tên -> đồng bộ tên trong 2 bảng đó; xóa -> chặn khi còn job dùng (gợi ý Inactive).
/// </summary>
public class DepartmentService : BaseService<DepartmentService>, IDepartmentService
{
    private static readonly string[] ValidStatuses = { "Active", "Inactive" };

    private readonly IDepartmentRepo _departmentRepo;
    private readonly ILogger _logger;

    public DepartmentService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _departmentRepo = serviceProvider.GetRequiredService<IDepartmentRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<DepartmentService>();
    }

    public async Task<DepartmentDto> CreateAsync(long companyId, DepartmentInputDto dto)
    {
        var name = ValidateName(dto);
        if (await _departmentRepo.NameExistsAsync(companyId, name))
            throw Conflict($"Phòng ban '{name}' đã tồn tại.");

        var department = new DepartmentEntity
        {
            Name = name,
            Description = Clean(dto.Description),
            Status = NormalizeStatus(dto.Status)
        };
        var departmentId = await _departmentRepo.InsertAsync(companyId, department);

        _logger.Information("Department: tạo phòng ban id={DepartmentId} '{Name}'.", departmentId, name);

        return await GetByIdAsync(companyId, departmentId);
    }

    public async Task<IReadOnlyList<DepartmentDto>> GetListAsync(long companyId)
    {
        var rows = await _departmentRepo.GetListAsync(companyId);
        return rows.Select(r => Map(r.Department, r.JobCount)).ToList();
    }

    public async Task<DepartmentDto> GetByIdAsync(long companyId, long departmentId)
    {
        var rows = await _departmentRepo.GetListAsync(companyId);
        var row = rows.FirstOrDefault(r => r.Department.DepartmentId == departmentId)
            ?? throw NotFound($"Không tìm thấy phòng ban (department_id={departmentId}).");
        return Map(row.Department, row.JobCount);
    }

    public async Task<DepartmentDto> UpdateAsync(long companyId, long departmentId, DepartmentInputDto dto)
    {
        var name = ValidateName(dto);
        var department = await _departmentRepo.GetByIdAsync(companyId, departmentId)
            ?? throw NotFound($"Không tìm thấy phòng ban (department_id={departmentId}).");
        if (await _departmentRepo.NameExistsAsync(companyId, name, exceptId: departmentId))
            throw Conflict($"Phòng ban '{name}' đã tồn tại.");

        var oldName = department.Name;
        department.Name = name;
        department.Description = Clean(dto.Description);
        department.Status = NormalizeStatus(dto.Status ?? department.Status);
        department.UpdatedAt = DateTime.UtcNow;
        await _departmentRepo.SaveAsync();

        // Job/RecruitmentRequest lưu tên phòng ban -> đổi tên phải đồng bộ, không thì mồ côi.
        if (!string.Equals(oldName, name, StringComparison.OrdinalIgnoreCase))
        {
            await _departmentRepo.RenameReferencesAsync(companyId, oldName, name);
            _logger.Information("Department: đổi tên '{OldName}' -> '{Name}', đã đồng bộ Job/RecruitmentRequest.",
                oldName, name);
        }

        return await GetByIdAsync(companyId, departmentId);
    }

    public async Task DeleteAsync(long companyId, long departmentId)
    {
        var department = await _departmentRepo.GetByIdAsync(companyId, departmentId)
            ?? throw NotFound($"Không tìm thấy phòng ban (department_id={departmentId}).");

        var jobCount = await _departmentRepo.CountJobsUsingAsync(companyId, department.Name);
        if (jobCount > 0)
            throw Conflict($"Phòng ban '{department.Name}' đang có {jobCount} tin tuyển dụng — " +
                "chuyển các tin sang phòng ban khác hoặc đổi trạng thái sang Inactive thay vì xóa.");

        await _departmentRepo.DeleteAsync(department);
        _logger.Information("Department: xóa phòng ban id={DepartmentId} '{Name}'.",
            departmentId, department.Name);
    }

    // ============================================================

    private static string ValidateName(DepartmentInputDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            throw Bad("Tên phòng ban không được để trống.");
        var name = dto.Name.Trim();
        if (name.Length > 255)
            throw Bad("Tên phòng ban tối đa 255 ký tự.");
        return name;
    }

    private static string NormalizeStatus(string? status)
    {
        var s = (status ?? "Active").Trim();
        return ValidStatuses.FirstOrDefault(v => v.Equals(s, StringComparison.OrdinalIgnoreCase)) ?? "Active";
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static DepartmentDto Map(DepartmentEntity d, int jobCount) => new()
    {
        DepartmentId = d.DepartmentId,
        Name = d.Name,
        Description = d.Description,
        Status = d.Status,
        JobCount = jobCount,
        CreatedAt = d.CreatedAt,
        UpdatedAt = d.UpdatedAt
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
