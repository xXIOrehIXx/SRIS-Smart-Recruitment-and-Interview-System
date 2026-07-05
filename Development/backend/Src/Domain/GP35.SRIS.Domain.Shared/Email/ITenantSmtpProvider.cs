using GP35.SRIS.Domain.Shared.Configs;

namespace GP35.SRIS.Domain.Shared.Email;

/// <summary>
/// Cung cấp cấu hình SMTP RIÊNG của tenant hiện tại (per-tenant email, Phase 2).
/// SmtpEmailService (tầng Lib, không truy cập được repo) hỏi provider này; có cấu hình riêng
/// thì gửi bằng SMTP của công ty đó (email đi từ tên miền họ), không thì fallback SMTP global.
/// Impl nằm ở tầng có ICompanyRepo + IContextData (Domain.SqlServer).
/// </summary>
public interface ITenantSmtpProvider
{
    /// <summary>SMTP của công ty đang trong ngữ cảnh request; null nếu chưa cấu hình / không có tenant.</summary>
    Task<SmtpOptions?> GetForCurrentTenantAsync();
}
