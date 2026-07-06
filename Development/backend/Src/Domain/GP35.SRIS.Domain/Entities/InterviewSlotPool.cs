using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Bộ khung phỏng vấn DÙNG CHUNG (docs 15). Một pool gắn 1 job + 1 vòng, mở nhiều khung
/// (InterviewSlot) mà nhiều ứng viên cùng chọn — ai chốt trước lấy trước. Không gắn application.
/// </summary>
public class InterviewSlotPool : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("pool_id")]
    public long PoolId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("job_id")]
    public long JobId { get; set; }
    [Column("round_number")]
    public int RoundNumber { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("created_by")]
    public long? CreatedBy { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
