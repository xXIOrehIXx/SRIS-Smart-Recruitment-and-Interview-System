using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Hình thức làm việc — danh mục do Admin quản lý (V027), thay cho danh sách cứng
/// trong code. Job/RecruitmentRequest tham chiếu bằng TÊN (cột employment_type có sẵn),
/// không FK — giống <see cref="Department"/>; đổi tên thì EmploymentTypeService tự
/// đồng bộ tên trong Job/RecruitmentRequest.
/// </summary>
public class EmploymentType : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("employment_type_id")]
    public long EmploymentTypeId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }

    [Column("name")]
    public string Name { get; set; } = null!;

    [Column("description")]
    public string? Description { get; set; }

    /// <summary>Active | Inactive (Inactive = ẩn khỏi dropdown, giữ dữ liệu cũ).</summary>
    [Column("status")]
    public string Status { get; set; } = "Active";

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
