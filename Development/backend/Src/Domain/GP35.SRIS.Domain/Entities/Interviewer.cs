using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class Interviewer : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("interviewer_id")]
    public long InterviewerId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("full_name")]
    public string FullName { get; set; } = null!;
    [Column("email")]
    public string Email { get; set; } = null!;
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}