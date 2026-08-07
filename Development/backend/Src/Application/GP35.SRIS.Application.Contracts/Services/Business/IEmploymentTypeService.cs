using GP35.SRIS.Application.Contracts.Dtos.Business.EmploymentType;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Danh mục hình thức làm việc (V027): Admin CRUD; mọi role đăng nhập đọc được để đổ
/// dropdown (Human Resource tạo Job, DM tạo Yêu cầu tuyển dụng — hai form giờ dùng CHUNG
/// một danh mục, không còn quy đổi từ vựng). Job tham chiếu bằng TÊN — đổi tên thì
/// đồng bộ Job/RecruitmentRequest; xóa bị chặn khi còn job dùng (chuyển Inactive thay thế).
/// </summary>
public interface IEmploymentTypeService : IBaseService
{
    Task<EmploymentTypeDto> CreateAsync(long companyId, EmploymentTypeInputDto dto);

    Task<IReadOnlyList<EmploymentTypeDto>> GetListAsync(long companyId);

    Task<EmploymentTypeDto> GetByIdAsync(long companyId, long employmentTypeId);

    Task<EmploymentTypeDto> UpdateAsync(long companyId, long employmentTypeId, EmploymentTypeInputDto dto);

    /// <summary>Xóa cứng — chỉ khi không còn job dùng hình thức này.</summary>
    Task DeleteAsync(long companyId, long employmentTypeId);
}
