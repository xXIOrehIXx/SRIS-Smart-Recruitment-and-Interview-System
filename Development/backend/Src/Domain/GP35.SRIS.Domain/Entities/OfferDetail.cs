using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class OfferDetail : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("offer_id")]
    public long OfferId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("application_id")]
    public long ApplicationId { get; set; }
    [Column("salary_amount")]
    public decimal? SalaryAmount { get; set; }
    [Column("currency")]
    public string Currency { get; set; } = null!;
    [Column("start_date")]
    public DateTime? StartDate { get; set; }
    [Column("decided_by")]
    public long? DecidedBy { get; set; }
    [Column("note")]
    public string? Note { get; set; }
    [Column("status")]
    public string Status { get; set; } = null!;

    // --- Nội dung thư mời nhận việc (V029) ---------------------------------
    // Chụp lại từ Job/Company lúc soạn thư: thư đã gửi là văn bản đối ngoại,
    // sửa Job về sau KHÔNG được làm đổi nội dung thư đã phát đi.

    [Column("job_title")]
    public string? JobTitle { get; set; }
    [Column("department")]
    public string? Department { get; set; }
    [Column("reporting_to")]
    public string? ReportingTo { get; set; }
    [Column("employment_type")]
    public string? EmploymentType { get; set; }
    [Column("work_location")]
    public string? WorkLocation { get; set; }
    /// <summary>Kỳ lương in trên thư: "THANG" (tháng) hoặc "NAM" (năm).</summary>
    [Column("salary_period")]
    public string? SalaryPeriod { get; set; }
    [Column("bonus")]
    public string? Bonus { get; set; }
    [Column("benefits")]
    public string? Benefits { get; set; }
    [Column("terms")]
    public string? Terms { get; set; }
    [Column("hr_contact_name")]
    public string? HrContactName { get; set; }
    [Column("hr_contact_email")]
    public string? HrContactEmail { get; set; }
    [Column("signer_name")]
    public string? SignerName { get; set; }
    [Column("signer_title")]
    public string? SignerTitle { get; set; }

    /// <summary>Người ghi nhận kết quả cuối (khác <see cref="DecidedBy"/> — người ra offer).</summary>
    [Column("outcome_by")]
    public long? OutcomeBy { get; set; }
    [Column("outcome_note")]
    public string? OutcomeNote { get; set; }
    [Column("sent_at")]
    public DateTime? SentAt { get; set; }
    [Column("expires_at")]
    public DateTime? ExpiresAt { get; set; }
    [Column("responded_at")]
    public DateTime? RespondedAt { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}