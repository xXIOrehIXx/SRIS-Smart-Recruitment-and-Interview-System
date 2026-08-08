using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

/// <summary>
/// Kết luận của MỘT người phỏng vấn cho MỘT buổi: nên tuyển hay không, và vì sao (V031).
/// Đây là thứ người quyết tuyển (DM) đọc — điểm từng tiêu chí chỉ là phần bổ trợ.
/// <para><see cref="SubmittedAt"/> null = còn nháp, blind review chưa mở.</para>
/// </summary>
public class InterviewFeedback : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("feedback_id")]
    public long FeedbackId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("schedule_id")]
    public long ScheduleId { get; set; }
    [Column("interviewer_id")]
    public long InterviewerId { get; set; }

    /// <summary>HIRE | NO_HIRE | UNSURE. Null khi người chấm chưa chọn (còn nháp).</summary>
    [Column("recommendation")]
    public string? Recommendation { get; set; }

    /// <summary>Nhận xét tổng — lý do đề xuất như vậy.</summary>
    [Column("summary")]
    public string? Summary { get; set; }

    [Column("submitted_at")]
    public DateTime? SubmittedAt { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
