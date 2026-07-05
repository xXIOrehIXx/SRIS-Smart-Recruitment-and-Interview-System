using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Lib.Services;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services;

public class CompanyService : BaseService<CompanyService>, ICompanyService
{
  public CompanyService(IServiceProvider serviceProvider) : base(serviceProvider)
  {
  }

  public async Task<CompanyGetDto> GetByCompanyId(long companyId)
  {
    var companyRepo = _serviceProvider.GetRequiredService<ICompanyRepo>();

    var company = await companyRepo.GetByCompanyId(companyId);

    return _mapper.Map<Company, CompanyGetDto>(company);
  }

  public async Task<CompanyGetDto> UpdateBrandAsync(long companyId, UpdateBrandDto dto)
  {
    var companyRepo = _serviceProvider.GetRequiredService<ICompanyRepo>();

    var company = await companyRepo.UpdateBrandAsync(
        companyId,
        Normalize(dto.Name),
        Normalize(dto.LogoUrl),
        Normalize(dto.PrimaryColor));

    if (company is null)
      throw new KeyNotFoundException($"Không tìm thấy công ty (company_id={companyId}).");

    return _mapper.Map<Company, CompanyGetDto>(company);
  }

  public async Task<CompanySmtpDto> GetSmtpAsync(long companyId)
  {
    var company = await _serviceProvider.GetRequiredService<ICompanyRepo>().GetByCompanyId(companyId);
    if (company is null)
      throw new KeyNotFoundException($"Không tìm thấy công ty (company_id={companyId}).");
    return ToSmtpDto(company);
  }

  public async Task<CompanySmtpDto> UpdateSmtpAsync(long companyId, UpdateSmtpDto dto)
  {
    // Mã hoá mật khẩu trước khi lưu (trống -> null -> repo giữ nguyên mật khẩu cũ).
    var rawPassword = Normalize(dto.Password);
    var encPassword = rawPassword is null
        ? null
        : _serviceProvider.GetRequiredService<GP35.SRIS.Domain.Shared.Security.ISecretProtector>().Protect(rawPassword);

    var company = await _serviceProvider.GetRequiredService<ICompanyRepo>().UpdateSmtpAsync(
        companyId,
        Normalize(dto.Host),
        dto.Port,
        Normalize(dto.Username),
        encPassword,
        Normalize(dto.FromEmail));

    if (company is null)
      throw new KeyNotFoundException($"Không tìm thấy công ty (company_id={companyId}).");
    return ToSmtpDto(company);
  }

  public async Task<bool> SendTestEmailAsync(long companyId, string toEmail)
  {
    // IEmailService tự resolve SMTP của tenant hiện hành (qua ITenantSmtpProvider).
    var email = _serviceProvider.GetRequiredService<IEmailService>();
    var body = "<p>Đây là email thử từ SRIS. Nếu bạn nhận được, cấu hình SMTP của công ty đã hoạt động.</p>";
    var result = await email.SendEmailAsync("[SRIS] Kiểm tra cấu hình email", body, toEmail, string.Empty);
    return !string.IsNullOrEmpty(result);
  }

  private static CompanySmtpDto ToSmtpDto(Company c) => new()
  {
    Host = c.SmtpHost,
    Port = c.SmtpPort,
    Username = c.SmtpUsername,
    FromEmail = c.SmtpFromEmail,
    HasPassword = !string.IsNullOrEmpty(c.SmtpPassword),
    Configured = !string.IsNullOrWhiteSpace(c.SmtpHost)
  };

  // Trắng -> null (giữ nguyên giá trị cũ); ngược lại trim.
  private static string? Normalize(string? value) =>
      string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}