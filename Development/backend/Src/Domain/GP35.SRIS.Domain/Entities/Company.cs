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

    // Liên hệ in ở đầu thư mời nhận việc (V029) — nhập 1 lần ở hồ sơ công ty.
    [Column("address")]
    public string? Address { get; set; }
    [Column("contact_email")]
    public string? ContactEmail { get; set; }
    [Column("phone")]
    public string? Phone { get; set; }

    /// <summary>
    /// Quyền lợi mặc định, các dòng ngăn bởi '\n' (V035). Điền sẵn vào tin tuyển dụng MỚI —
    /// chép một lần lúc tạo, sửa ở đây không đổi các tin đã đăng.
    /// </summary>
    [Column("default_benefits")]
    public string? DefaultBenefits { get; set; }

    [Column("email_domain")]
    public string? EmailDomain { get; set; }
    [Column("smtp_host")]
    public string? SmtpHost { get; set; }
    [Column("smtp_port")]
    public int? SmtpPort { get; set; }
    [Column("smtp_username")]
    public string? SmtpUsername { get; set; }
    [Column("smtp_password")]
    public string? SmtpPassword { get; set; }
    [Column("smtp_from_email")]
    public string? SmtpFromEmail { get; set; }
    [Column("subscription_plan")]
    public string SubscriptionPlan { get; set; } = null!;
    [Column("status")]
    public string Status { get; set; } = null!;
    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}