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
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("sent_at")]
    public DateTime? SentAt { get; set; }
    [Column("responded_at")]
    public DateTime? RespondedAt { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}