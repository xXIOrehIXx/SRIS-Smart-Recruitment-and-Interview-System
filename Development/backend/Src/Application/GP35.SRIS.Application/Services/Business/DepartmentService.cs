using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Department;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
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
    private readonly IUserRepo _userRepo;
    private readonly ILogger _logger;

    public DepartmentService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _departmentRepo = serviceProvider.GetRequiredService<IDepartmentRepo>();
        _userRepo = serviceProvider.GetRequiredService<IUserRepo>();
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
            Status = NormalizeStatus(dto.Status),
            ManagerUserId = await ValidateManagerAsync(companyId, dto.ManagerUserId)
        };
        var departmentId = await _departmentRepo.InsertAsync(companyId, department);

        _logger.Information("Department: tạo phòng ban id={DepartmentId} '{Name}'.", departmentId, name);

        return await GetByIdAsync(companyId, departmentId);
    }

    public async Task<IReadOnlyList<DepartmentDto>> GetListAsync(long companyId)
    {
        var rows = await _departmentRepo.GetListAsync(companyId);
        return rows.Select(r => Map(r.Department, r.JobCount, r.ManagerName, r.ManagerEmail)).ToList();
    }

    public async Task<DepartmentDto> GetByIdAsync(long companyId, long departmentId)
    {
        var rows = await _departmentRepo.GetListAsync(companyId);
        var row = rows.FirstOrDefault(r => r.Department.DepartmentId == departmentId)
            ?? throw NotFound($"Không tìm thấy phòng ban (department_id={departmentId}).");
        return Map(row.Department, row.JobCount, row.ManagerName, row.ManagerEmail);
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
        department.ManagerUserId = await ValidateManagerAsync(companyId, dto.ManagerUserId);
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

    /// <summary>
    /// Kiểm DM gán cho phòng ban (V023): phải là user Active của CHÍNH công ty này và role
    /// DepartmentManager (hoặc Admin — công ty nhỏ chạy 1 tài khoản Admin kiêm hết).
    /// Null/0 = bỏ trống, hợp lệ.
    /// </summary>
    private async Task<long?> ValidateManagerAsync(long companyId, long? managerUserId)
    {
        if (managerUserId is not > 0) return null;

        var user = await _userRepo.GetByIdAsync(companyId, managerUserId.Value)
            ?? throw Bad($"Không tìm thấy người dùng (user_id={managerUserId}) trong công ty.");

        if (!string.Equals(user.Status, "Active", StringComparison.OrdinalIgnoreCase))
            throw Bad($"Tài khoản '{user.Email}' đang bị khóa — không gán làm quản lý phòng ban được.");

        var allowed = string.Equals(user.Role, RoleConstants.DepartmentManager, StringComparison.OrdinalIgnoreCase)
                   || string.Equals(user.Role, RoleConstants.Admin, StringComparison.OrdinalIgnoreCase);
        if (!allowed)
            throw Bad($"'{user.Email}' đang là {user.Role} — quản lý phòng ban phải là DepartmentManager hoặc Admin.");

        return user.UserId;
    }

    private static string NormalizeStatus(string? status)
    {
        var s = (status ?? "Active").Trim();
        return ValidStatuses.FirstOrDefault(v => v.Equals(s, StringComparison.OrdinalIgnoreCase)) ?? "Active";
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static DepartmentDto Map(DepartmentEntity d, int jobCount, string? managerName, string? managerEmail) => new()
    {
        DepartmentId = d.DepartmentId,
        Name = d.Name,
        Description = d.Description,
        Status = d.Status,
        JobCount = jobCount,
        ManagerUserId = d.ManagerUserId,
        // full_name hay để trống -> rơi về email cho FE khỏi hiện ô rỗng.
        ManagerName = string.IsNullOrWhiteSpace(managerName) ? managerEmail : managerName,
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
