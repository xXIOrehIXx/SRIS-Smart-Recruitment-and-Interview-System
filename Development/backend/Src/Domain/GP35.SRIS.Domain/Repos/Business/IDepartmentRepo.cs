using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 dòng danh sách phòng ban kèm số job đang dùng (join Job theo tên).</summary>
public record DepartmentRow(Department Department, int JobCount);

public interface IDepartmentRepo : IBaseRepo<long, Department>
{
    /// <summary>Tạo phòng ban, trả department_id.</summary>
    Task<long> InsertAsync(long companyId, Department department);

    /// <summary>Danh sách phòng ban của công ty (A→Z) kèm số job đang dùng tên đó.</summary>
    Task<IReadOnlyList<DepartmentRow>> GetListAsync(long companyId);

    /// <summary>1 phòng ban theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<Department?> GetByIdAsync(long companyId, long departmentId);

    /// <summary>Tên đã tồn tại trong company chưa (exceptId = bỏ qua chính nó khi sửa).</summary>
    Task<bool> NameExistsAsync(long companyId, string name, long? exceptId = null);

    /// <summary>Số job đang dùng tên phòng ban này (chặn xóa khi &gt; 0).</summary>
    Task<int> CountJobsUsingAsync(long companyId, string name);

    /// <summary>Đổi tên phòng ban -> đồng bộ tên trong Job + RecruitmentRequest (tham chiếu bằng tên).</summary>
    Task RenameReferencesAsync(long companyId, string oldName, string newName);

    /// <summary>Xóa cứng 1 phòng ban (service đã check không còn job dùng).</summary>
    Task DeleteAsync(Department department);

    /// <summary>Lưu thay đổi trên entity đang track (service sửa field xong gọi).</summary>
    Task SaveAsync();
}
