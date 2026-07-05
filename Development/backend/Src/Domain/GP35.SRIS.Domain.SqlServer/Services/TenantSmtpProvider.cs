using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Email;
using GP35.SRIS.Domain.Shared.Security;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Services;

/// <summary>
/// Đọc SMTP riêng của công ty đang trong ngữ cảnh request (IContextData.CompanyId).
/// Company là bảng tenant gốc (không dưới RLS) nên đọc thẳng. Chưa cấu hình smtp_host -> null
/// (SmtpEmailService fallback SMTP global).
/// </summary>
public class TenantSmtpProvider : ITenantSmtpProvider
{
    private readonly IServiceProvider _sp;

    public TenantSmtpProvider(IServiceProvider sp) => _sp = sp;

    public async Task<SmtpOptions?> GetForCurrentTenantAsync()
    {
        var ctx = _sp.GetRequiredService<IContextData>();
        var companyId = ctx.CompanyId;
        if (companyId <= 0) return null; // ẩn danh / chưa xác định tenant -> dùng global

        var company = await _sp.GetRequiredService<ICompanyRepo>().GetByCompanyId(companyId);
        if (company is null || string.IsNullOrWhiteSpace(company.SmtpHost)) return null;

        return new SmtpOptions
        {
            Host = company.SmtpHost!,
            Port = company.SmtpPort ?? 587,
            User = company.SmtpUsername ?? string.Empty,
            Password = string.IsNullOrEmpty(company.SmtpPassword)
                ? string.Empty
                : _sp.GetRequiredService<ISecretProtector>().Unprotect(company.SmtpPassword),
            FromEmail = string.IsNullOrWhiteSpace(company.SmtpFromEmail)
                ? (company.SmtpUsername ?? string.Empty)
                : company.SmtpFromEmail!,
            FromName = string.IsNullOrWhiteSpace(company.Name) ? "SRIS Recruitment" : company.Name,
            UseStartTls = true
        };
    }
}
