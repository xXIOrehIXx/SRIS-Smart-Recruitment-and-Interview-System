using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class JobApprover : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("approver_id")]
    public long ApproverId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("job_id")]
    public long JobId { get; set; }
    [Column("gate")]
    public string Gate { get; set; } = null!;
    [Column("interviewer_id")]
    public long InterviewerId { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}