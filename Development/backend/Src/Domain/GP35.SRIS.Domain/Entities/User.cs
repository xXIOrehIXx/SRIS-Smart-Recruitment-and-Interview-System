using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.Entities;

public class User : BaseEntity<Guid>, IHasCreateInfo, IHasModifyInfo, IHasCompanyInfo
{
    [Key]
    [Column("user_id")]
    public long UserId { get; set; }

    [Column("company_id")]
    public long CompanyId { get; set; }

    public string Email { get; set; }

    [Column("password_hash")]
    public string PasswordHash { get; set; }

    public string Salt { get; set; }
    public string Role { get; set; }

    public string Status { get; set; } = "Active";

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
