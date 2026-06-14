using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class Candidate : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("candidate_id")]
    public long CandidateId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }
    [Column("full_name")]
    public string FullName { get; set; } = null!;
    [Column("email")]
    public string Email { get; set; } = null!;
    [Column("phone")]
    public string? Phone { get; set; }
    [Column("source")]
    public string? Source { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}