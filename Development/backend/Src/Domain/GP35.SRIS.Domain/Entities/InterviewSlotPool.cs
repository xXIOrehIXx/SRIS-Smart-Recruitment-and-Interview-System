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
    /// <summary>
    /// Vòng thứ mấy của VỊ TRÍ này (1, 2, 3...). Hệ thống tự đánh tăng dần — người dùng không gõ,
    /// nên không bao giờ có dãy thủng lỗ kiểu 1 rồi 5.
    /// </summary>
    [Column("round_number")]
    public int RoundNumber { get; set; }

    /// <summary>
    /// Tên vòng do Human Resource đặt ("Phỏng vấn chuyên môn", "Gặp giám đốc") — V041. Null =
    /// không đặt tên, UI hiện "Vòng N". Đây là thứ nói cho interviewer/ứng viên biết buổi này
    /// để làm gì; con số chỉ nói thứ tự.
    /// </summary>
    [Column("name")]
    public string? Name { get; set; }

    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("created_by")]
    public long? CreatedBy { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
