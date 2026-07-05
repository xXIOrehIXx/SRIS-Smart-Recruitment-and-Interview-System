using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Lib.Services;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Email tự động cho ứng viên (5.13 "Actionable Email"). Best-effort — bọc try/catch, chỉ log,
/// KHÔNG ném ra ngoài: gửi mail hỏng không được phép làm rớt transition/issue link.
/// </summary>
public class NotificationService : BaseService<NotificationService>, INotificationService
{
    private const string DefaultBaseUrl = "http://localhost:3000";
    private const int InterviewDurationMinutes = 60; // schema chưa lưu end_time -> dùng độ dài mặc định

    private readonly IApplicationRepo _appRepo;
    private readonly IEmailTemplateRepo _templateRepo;
    private readonly IEmailService _email;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public NotificationService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _templateRepo = serviceProvider.GetRequiredService<IEmailTemplateRepo>();
        _email = serviceProvider.GetRequiredService<IEmailService>();
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<NotificationService>();
    }

    public async Task SendMagicLinkAsync(
        long companyId, long applicationId, string purpose, string rawToken, DateTime expiresAt)
    {
        try
        {
            var info = await _appRepo.GetContactInfoAsync(companyId, applicationId);
            if (info is null || string.IsNullOrWhiteSpace(info.CandidateEmail))
            {
                _logger.Warning("Notify: bỏ qua email {Purpose} — hồ sơ {AppId} không có email ứng viên.",
                    purpose, applicationId);
                return;
            }

            var link = BuildLink(purpose, rawToken);
            var expiresText = $"{expiresAt:dd/MM/yyyy HH:mm} UTC";

            // Template động (M4): ưu tiên template active theo loại; không có thì dùng nội dung mặc định.
            var placeholders = new Dictionary<string, string>
            {
                ["candidateName"] = info.CandidateName ?? "",
                ["jobTitle"] = info.JobTitle ?? "",
                ["link"] = link,
                ["expiresAt"] = expiresText
            };

            string subject, body;
            var rendered = await TryRenderTemplateAsync(companyId, purpose, placeholders);
            if (rendered is not null)
            {
                (subject, body) = rendered.Value;
            }
            else
            {
                var (defSubject, intro, button) = MagicLinkContent(purpose, info.JobTitle);
                subject = defSubject;
                body = HtmlEmail(info.CandidateName, intro, button, link,
                    $"Liên kết có hiệu lực đến {expiresText}.");
            }

            await _email.SendEmailAsync(subject, body, info.CandidateEmail, string.Empty);
            _logger.Information("Notify: gửi email {Purpose} cho {Email} (app={AppId}).",
                purpose, info.CandidateEmail, applicationId);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Notify: lỗi gửi email {Purpose} (app={AppId}) — bỏ qua (best-effort).",
                purpose, applicationId);
        }
    }

    public async Task SendResultAsync(long companyId, long applicationId, string toState)
    {
        // Chỉ gửi ở 2 trạng thái chốt (có gửi email cho ứng viên).
        var isHired = string.Equals(toState, ApplicationState.Hired, StringComparison.OrdinalIgnoreCase);
        var isRejected = string.Equals(toState, ApplicationState.Rejected, StringComparison.OrdinalIgnoreCase);
        if (!isHired && !isRejected) return;

        try
        {
            var info = await _appRepo.GetContactInfoAsync(companyId, applicationId);
            if (info is null || string.IsNullOrWhiteSpace(info.CandidateEmail))
            {
                _logger.Warning("Notify: bỏ qua email kết quả — hồ sơ {AppId} không có email ứng viên.",
                    applicationId);
                return;
            }

            var placeholders = new Dictionary<string, string>
            {
                ["candidateName"] = info.CandidateName ?? "",
                ["jobTitle"] = info.JobTitle ?? ""
            };

            string subject, body;
            var rendered = await TryRenderTemplateAsync(companyId, toState, placeholders);
            if (rendered is not null)
            {
                (subject, body) = rendered.Value;
            }
            else
            {
                string intro;
                if (isHired)
                {
                    subject = $"Chúc mừng! Kết quả tuyển dụng vị trí {info.JobTitle}";
                    intro = $"Chúc mừng bạn đã trúng tuyển vị trí <b>{info.JobTitle}</b>. " +
                            "Bộ phận tuyển dụng sẽ liên hệ với bạn về các bước tiếp theo.";
                }
                else
                {
                    subject = $"Kết quả ứng tuyển vị trí {info.JobTitle}";
                    intro = $"Cảm ơn bạn đã quan tâm vị trí <b>{info.JobTitle}</b>. Rất tiếc lần này hồ sơ " +
                            "của bạn chưa phù hợp. Chúng tôi sẽ lưu hồ sơ và liên hệ khi có cơ hội phù hợp hơn.";
                }
                body = HtmlEmail(info.CandidateName, intro, null, null, null);
            }

            await _email.SendEmailAsync(subject, body, info.CandidateEmail, string.Empty);
            _logger.Information("Notify: gửi email kết quả {State} cho {Email} (app={AppId}).",
                toState, info.CandidateEmail, applicationId);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Notify: lỗi gửi email kết quả {State} (app={AppId}) — bỏ qua (best-effort).",
                toState, applicationId);
        }
    }

    public async Task SendInterviewConfirmedAsync(long companyId, long applicationId, DateTime startTimeUtc)
    {
        try
        {
            var info = await _appRepo.GetContactInfoAsync(companyId, applicationId);
            if (info is null || string.IsNullOrWhiteSpace(info.CandidateEmail))
            {
                _logger.Warning("Notify: bỏ qua email xác nhận lịch — hồ sơ {AppId} không có email ứng viên.",
                    applicationId);
                return;
            }

            var startUtc = DateTime.SpecifyKind(startTimeUtc, DateTimeKind.Utc);
            var endUtc = startUtc.AddMinutes(InterviewDurationMinutes);
            var summary = $"Phỏng vấn — {info.JobTitle}";
            var description = $"Buổi phỏng vấn cho vị trí {info.JobTitle}. Vui lòng tham gia đúng giờ.";

            var ics = CalendarInviteBuilder.BuildIcs(summary, description, startUtc, endUtc);
            var gcalUrl = CalendarInviteBuilder.BuildGoogleCalendarUrl(summary, description, startUtc, endUtc);

            var startText = $"{startUtc:HH:mm dd/MM/yyyy} (UTC)";
            var placeholders = new Dictionary<string, string>
            {
                ["candidateName"] = info.CandidateName ?? "",
                ["jobTitle"] = info.JobTitle ?? "",
                ["startTime"] = startText,
                ["link"] = gcalUrl
            };

            string body;
            var rendered = await TryRenderTemplateAsync(
                companyId, EmailTemplateType.InterviewConfirmed, placeholders);
            if (rendered is not null)
            {
                body = rendered.Value.Body; // subject của loại này cố định bên dưới (kèm .ics)
            }
            else
            {
                var intro = $"Lịch phỏng vấn vị trí <b>{info.JobTitle}</b> đã được xác nhận vào lúc " +
                            $"<b>{startText}</b>. File lịch (.ics) đính kèm — mở để thêm vào " +
                            "ứng dụng lịch của bạn, hoặc dùng nút bên dưới để thêm vào Google Calendar.";
                body = HtmlEmail(info.CandidateName, intro, "Thêm vào Google Calendar", gcalUrl, null);
            }

            var attachment = new GP35.SRIS.Lib.Models.EmailAttachment
            {
                FileName = "interview",
                FileExtension = ".ics",
                FileContent = System.Text.Encoding.UTF8.GetBytes(ics)
            };

            await _email.SendEmailAttachmentOnlyAsync(
                $"Xác nhận lịch phỏng vấn — {info.JobTitle}",
                body,
                info.CandidateEmail,
                new List<string>(),
                new List<GP35.SRIS.Lib.Models.EmailAttachment> { attachment });

            _logger.Information("Notify: gửi email xác nhận lịch + .ics cho {Email} (app={AppId}).",
                info.CandidateEmail, applicationId);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Notify: lỗi gửi email xác nhận lịch (app={AppId}) — bỏ qua (best-effort).",
                applicationId);
        }
    }

    public async Task SendInterviewCancelledAsync(
        long companyId, long applicationId, DateTime? startTimeUtc, string? reason)
    {
        try
        {
            var info = await _appRepo.GetContactInfoAsync(companyId, applicationId);
            if (info is null || string.IsNullOrWhiteSpace(info.CandidateEmail))
            {
                _logger.Warning("Notify: bỏ qua email hủy lịch — hồ sơ {AppId} không có email ứng viên.",
                    applicationId);
                return;
            }

            var startText = startTimeUtc is DateTime t
                ? $"{DateTime.SpecifyKind(t, DateTimeKind.Utc):HH:mm dd/MM/yyyy} (UTC)"
                : "";
            var reasonText = string.IsNullOrWhiteSpace(reason) ? "" : reason.Trim();

            var placeholders = new Dictionary<string, string>
            {
                ["candidateName"] = info.CandidateName ?? "",
                ["jobTitle"] = info.JobTitle ?? "",
                ["startTime"] = startText,
                ["reason"] = reasonText
            };

            string subject, body;
            var rendered = await TryRenderTemplateAsync(
                companyId, EmailTemplateType.InterviewCancelled, placeholders);
            if (rendered is not null)
            {
                (subject, body) = rendered.Value;
            }
            else
            {
                subject = $"Lịch phỏng vấn đã bị hủy — vị trí {info.JobTitle}";
                var when = string.IsNullOrEmpty(startText) ? "" : $" (dự kiến lúc <b>{startText}</b>)";
                var because = string.IsNullOrEmpty(reasonText) ? "" : $" Lý do: {reasonText}.";
                var intro = $"Lịch phỏng vấn vị trí <b>{info.JobTitle}</b>{when} đã bị hủy.{because} " +
                            "Bộ phận tuyển dụng sẽ liên hệ lại nếu cần sắp xếp buổi mới.";
                body = HtmlEmail(info.CandidateName, intro, null, null, null);
            }

            await _email.SendEmailAsync(subject, body, info.CandidateEmail, string.Empty);
            _logger.Information("Notify: gửi email hủy lịch cho {Email} (app={AppId}).",
                info.CandidateEmail, applicationId);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Notify: lỗi gửi email hủy lịch (app={AppId}) — bỏ qua (best-effort).",
                applicationId);
        }
    }

    // ============================================================

    /// <summary>
    /// Tra template active theo loại + render placeholder. Trả null nếu công ty chưa cấu hình template
    /// loại đó (caller dùng nội dung mặc định). Lỗi tra template không làm hỏng gửi mail — coi như không có.
    /// </summary>
    private async Task<(string Subject, string Body)?> TryRenderTemplateAsync(
        long companyId, string type, IReadOnlyDictionary<string, string> placeholders)
    {
        try
        {
            var template = await _templateRepo.GetActiveByTypeAsync(companyId, type.ToUpperInvariant());
            if (template is null) return null;
            return (Render(template.Subject, placeholders), Render(template.Body, placeholders));
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "Notify: lỗi tra template '{Type}' — dùng nội dung mặc định.", type);
            return null;
        }
    }

    /// <summary>Thay placeholder {{key}} (cho phép khoảng trắng: {{ key }}) bằng giá trị. Không phân biệt hoa thường.</summary>
    private static string Render(string template, IReadOnlyDictionary<string, string> values)
    {
        foreach (var kv in values)
        {
            var pattern = "{{\\s*" + System.Text.RegularExpressions.Regex.Escape(kv.Key) + "\\s*}}";
            template = System.Text.RegularExpressions.Regex.Replace(
                template, pattern, kv.Value.Replace("$", "$$"),
                System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        }
        return template;
    }

    private string BuildLink(string purpose, string rawToken)
    {
        var baseUrl = (_config.CandidatePortal?.BaseUrl ?? DefaultBaseUrl).TrimEnd('/');
        var path = purpose?.ToUpperInvariant() switch
        {
            "SCHEDULE" => "schedule",
            "OFFER_RESPONSE" => "offer",
            "STATUS" => "status",
            _ => "candidate"
        };
        return $"{baseUrl}/{path}?token={Uri.EscapeDataString(rawToken)}";
    }

    private static (string Subject, string Intro, string Button) MagicLinkContent(string purpose, string jobTitle)
        => purpose?.ToUpperInvariant() switch
        {
            "SCHEDULE" => ($"Mời chọn lịch phỏng vấn — vị trí {jobTitle}",
                       $"Vui lòng chọn khung giờ phỏng vấn phù hợp cho vị trí <b>{jobTitle}</b>.", "Chọn lịch phỏng vấn"),
            "OFFER_RESPONSE" => ($"Thư mời nhận việc — vị trí {jobTitle}",
                       $"Chúc mừng! Bạn nhận được offer cho vị trí <b>{jobTitle}</b>. " +
                       "Nhấn nút bên dưới để xem chi tiết và phản hồi.", "Xem & phản hồi offer"),
            "STATUS" => ($"Trạng thái hồ sơ — vị trí {jobTitle}",
                       $"Nhấn nút bên dưới để xem trạng thái hồ sơ ứng tuyển vị trí <b>{jobTitle}</b>.", "Xem trạng thái"),
            _ => ("Thông báo từ bộ phận tuyển dụng",
                       "Bạn có một liên kết cần xử lý.", "Mở liên kết")
        };

    /// <summary>Email HTML tối giản: lời chào + nội dung + (tùy chọn) nút magic link + ghi chú hạn.</summary>
    private static string HtmlEmail(string name, string intro, string? buttonText, string? link, string? footer)
    {
        var button = buttonText is not null && link is not null
            ? $"<p style=\"margin:24px 0\"><a href=\"{link}\" " +
              "style=\"background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;" +
              $"text-decoration:none;display:inline-block\">{buttonText}</a></p>" +
              $"<p style=\"font-size:12px;color:#666\">Nếu nút không hoạt động, dán liên kết này vào trình duyệt:<br>{link}</p>"
            : string.Empty;
        var foot = string.IsNullOrEmpty(footer) ? string.Empty : $"<p style=\"font-size:12px;color:#666\">{footer}</p>";

        return $@"<div style=""font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#111"">
  <p>Xin chào {name},</p>
  <p>{intro}</p>
  {button}
  {foot}
  <hr style=""border:none;border-top:1px solid #eee;margin:24px 0"">
  <p style=""font-size:12px;color:#999"">Email tự động từ hệ thống tuyển dụng SRIS — vui lòng không trả lời email này.</p>
</div>";
    }
}
