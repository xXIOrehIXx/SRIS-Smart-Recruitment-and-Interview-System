using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class Company : BaseEntity<long>, IHasCreateInfo, IHasModifyInfo
{
    [Key]
    [Column("company_id")]
    public long CompanyId { get; set; }

    [Column("name")]
    public string Name { get; set; } = null!;
    [Column("slug")]
    public string Slug { get; set; } = null!;
    [Column("logo_url")]
    public string? LogoUrl { get; set; }
    [Column("primary_color")]
    public string? PrimaryColor { get; set; }
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}