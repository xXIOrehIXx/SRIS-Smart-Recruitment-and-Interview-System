using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>
/// 1 dòng danh mục hình thức làm việc kèm số job đang dùng (join Job theo tên) —
/// để FE cảnh báo trước khi xóa mà không phải gọi thêm API job.
/// </summary>
public record EmploymentTypeRow(EmploymentType EmploymentType, int JobCount);

public interface IEmploymentTypeRepo : IBaseRepo<long, EmploymentType>
{
    /// <summary>Tạo hình thức làm việc, trả employment_type_id.</summary>
    Task<long> InsertAsync(long companyId, EmploymentType employmentType);

    /// <summary>Danh sách của công ty (A→Z) kèm số job đang dùng tên đó.</summary>
    Task<IReadOnlyList<EmploymentTypeRow>> GetListAsync(long companyId);

    /// <summary>1 dòng theo id (đã lọc tenant). Null nếu không thuộc company.</summary>
    Task<EmploymentType?> GetByIdAsync(long companyId, long employmentTypeId);

    /// <summary>Tên đã tồn tại trong company chưa (exceptId = bỏ qua chính nó khi sửa).</summary>
    Task<bool> NameExistsAsync(long companyId, string name, long? exceptId = null);

    /// <summary>Số job đang dùng hình thức này (chặn xóa khi &gt; 0).</summary>
    Task<int> CountJobsUsingAsync(long companyId, string name);

    /// <summary>Đổi tên -> đồng bộ tên trong Job + RecruitmentRequest (tham chiếu bằng tên).</summary>
    Task RenameReferencesAsync(long companyId, string oldName, string newName);

    /// <summary>Xóa cứng (service đã check không còn job dùng).</summary>
    Task DeleteAsync(EmploymentType employmentType);

    /// <summary>Lưu thay đổi trên entity đang track (service sửa field xong gọi).</summary>
    Task SaveAsync();
}
