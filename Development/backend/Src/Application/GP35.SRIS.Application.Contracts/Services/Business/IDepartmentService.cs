using GP35.SRIS.Application.Contracts.Dtos.Business.Department;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Danh mục phòng ban (V022): Admin CRUD; mọi role đăng nhập đọc được để đổ dropdown
/// (Recruiter tạo Job, DM tạo Yêu cầu tuyển dụng). Job tham chiếu bằng TÊN — đổi tên
/// thì đồng bộ Job/RecruitmentRequest; xóa bị chặn khi còn job dùng (chuyển Inactive thay thế).
/// </summary>
public interface IDepartmentService : IBaseService
{
    Task<DepartmentDto> CreateAsync(long companyId, DepartmentInputDto dto);

    Task<IReadOnlyList<DepartmentDto>> GetListAsync(long companyId);

    Task<DepartmentDto> GetByIdAsync(long companyId, long departmentId);

    Task<DepartmentDto> UpdateAsync(long companyId, long departmentId, DepartmentInputDto dto);

    /// <summary>Xóa cứng — chỉ khi không còn job dùng tên phòng ban này.</summary>
    Task DeleteAsync(long companyId, long departmentId);
}
