namespace GP35.SRIS.Application.Contracts.Dtos;

public class CompanyGetDto : BaseEntityDto<long>
{
  public long CompanyId { get; set; }
  public string Name { get; set; } = null!;
  public string Slug { get; set; } = null!;
  public string? LogoUrl { get; set; }
  public string? PrimaryColor { get; set; }
  public string? Industry { get; set; }
  public string? EmailDomain { get; set; }
  public string? SmtpHost { get; set; }
  public int? SmtpPort { get; set; }
  public string? SmtpUsername { get; set; }
  public string? SmtpFromEmail { get; set; }
  public string SubscriptionPlan { get; set; } = null!;
  public string Status { get; set; } = null!;
  public DateTime? CreatedAt { get; set; }
  public DateTime? UpdatedAt { get; set; }
}