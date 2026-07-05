using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Email;
using GP35.SRIS.Lib.Models;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.DependencyInjection;
using MimeKit;
using Serilog;

namespace GP35.SRIS.Lib.Services;

/// <summary>
/// Gửi email trực tiếp qua SMTP bằng MailKit (vd Gmail smtp.gmail.com:587 + App Password).
/// Thay cho <see cref="EmailService"/> (NotificationCenter) — chỉ cần đổi 1 dòng DI.
/// Best-effort: Host trống hoặc lỗi gửi -> log + trả rỗng, KHÔNG ném (NotificationService cũng đã bọc).
/// </summary>
public class SmtpEmailService : IEmailService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public SmtpEmailService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<SmtpEmailService>();
    }

    public Task<string> SendEmailAsync(string subject, string body, string toEmail, string ccEmail)
        => SendAsync(subject, body, SplitList(toEmail), SplitList(ccEmail), null);

    public Task<string> SendEmailAttachmentAsync(
        string subject, string body, List<string> toEmails, List<string> ccEmails, List<EmailAttachment> attachments)
        => SendAsync(subject, body, toEmails, ccEmails, attachments);

    public Task<string> SendEmailAttachmentOnlyAsync(
        string subject, string body, string toEmail, List<string> ccEmail, List<EmailAttachment> attachments)
        => SendAsync(subject, body, SplitList(toEmail), ccEmail, attachments);

    /// <summary>Template file-based — không dùng ở luồng email ứng viên (NotificationService tự dựng HTML).</summary>
    public Task<string> BuilTemplateEmailAsync(string fileName) => Task.FromResult(string.Empty);

    // ============================================================

    private async Task<string> SendAsync(
        string subject, string body, List<string>? to, List<string>? cc, List<EmailAttachment>? attachments)
    {
        // Per-tenant (Phase 2): công ty có SMTP riêng -> gửi bằng cấu hình đó (email từ tên miền họ);
        // chưa cấu hình / lỗi tra -> fallback SMTP global (appsettings).
        SmtpOptions? tenantSmtp = null;
        try
        {
            tenantSmtp = await _serviceProvider.GetRequiredService<ITenantSmtpProvider>()
                .GetForCurrentTenantAsync();
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "SMTP: tra cấu hình tenant lỗi -> dùng SMTP global.");
        }
        var smtp = tenantSmtp ?? _config.Smtp;
        if (smtp is null || string.IsNullOrWhiteSpace(smtp.Host))
        {
            _logger.Warning("SMTP: chưa cấu hình Host -> bỏ qua gửi email '{Subject}'.", subject);
            return string.Empty;
        }

        try
        {
            var msg = new MimeMessage();
            var fromEmail = string.IsNullOrWhiteSpace(smtp.FromEmail) ? smtp.User : smtp.FromEmail;
            msg.From.Add(new MailboxAddress(smtp.FromName ?? "SRIS", fromEmail));

            foreach (var addr in CleanAddrs(to)) msg.To.Add(MailboxAddress.Parse(addr));
            foreach (var addr in CleanAddrs(cc)) msg.Cc.Add(MailboxAddress.Parse(addr));
            if (msg.To.Count == 0)
            {
                _logger.Warning("SMTP: không có người nhận hợp lệ -> bỏ qua email '{Subject}'.", subject);
                return string.Empty;
            }

            msg.Subject = subject;
            var builder = new BodyBuilder { HtmlBody = body };
            if (attachments is not null)
                foreach (var a in attachments.Where(a => a?.FileContent is { Length: > 0 }))
                    builder.Attachments.Add($"{a.FileName}{a.FileExtension}", a.FileContent);
            msg.Body = builder.ToMessageBody();

            using var client = new SmtpClient();
            var socket = smtp.UseStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.SslOnConnect;
            await client.ConnectAsync(smtp.Host, smtp.Port, socket);
            if (!string.IsNullOrWhiteSpace(smtp.User))
                await client.AuthenticateAsync(smtp.User, smtp.Password);
            await client.SendAsync(msg);
            await client.DisconnectAsync(true);

            _logger.Information("SMTP: đã gửi '{Subject}' tới {To}.",
                subject, string.Join(",", msg.To.Mailboxes.Select(m => m.Address)));
            return "OK";
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "SMTP: lỗi gửi email '{Subject}'.", subject);
            return string.Empty;
        }
    }

    private static List<string> SplitList(string? s) =>
        string.IsNullOrWhiteSpace(s)
            ? new()
            : s.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private static IEnumerable<string> CleanAddrs(List<string>? addrs) =>
        (addrs ?? new()).Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => a.Trim());
}
