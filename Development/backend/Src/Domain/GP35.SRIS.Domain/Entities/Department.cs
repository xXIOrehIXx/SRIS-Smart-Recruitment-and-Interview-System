using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Phòng ban — danh mục do Admin quản lý (V022). Job/RecruitmentRequest tham chiếu
/// bằng TÊN (cột department NVARCHAR có sẵn), không FK; đổi tên phòng ban thì
/// DepartmentService tự đồng bộ tên trong Job/RecruitmentRequest.
/// <para>
/// V023: <see cref="ManagerUserId"/> = DM phụ trách phòng ban — nguồn để tự điền
/// <c>Job.department_manager_id</c> khi Human Resource chọn phòng ban lúc tạo job.
/// </para>
/// </summary>
public class Department : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("department_id")]
    public long DepartmentId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("name")]
    public string Name { get; set; } = null!;
    [Column("description")]
    public string? Description { get; set; }

    /// <summary>DM phụ trách phòng ban (V023). Null = chưa gán, job phải chọn DM tay.</summary>
    [Column("manager_user_id")]
    public long? ManagerUserId { get; set; }

    /// <summary>Active | Inactive (Inactive = ẩn khỏi dropdown, giữ dữ liệu cũ).</summary>
    [Column("status")]
    public string Status { get; set; } = "Active";
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
