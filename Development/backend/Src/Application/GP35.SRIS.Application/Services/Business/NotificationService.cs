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

    private readonly IApplicationRepo _appRepo;
    private readonly IEmailService _email;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public NotificationService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
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
            var (subject, intro, button) = MagicLinkContent(purpose, info.JobTitle);
            var body = HtmlEmail(
                info.CandidateName,
                intro,
                button,
                link,
                $"Liên kết có hiệu lực đến {expiresAt:dd/MM/yyyy HH:mm} UTC.");

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

            string subject, intro;
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

            var body = HtmlEmail(info.CandidateName, intro, null, null, null);
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

    // ============================================================

    private string BuildLink(string purpose, string rawToken)
    {
        var baseUrl = (_config.CandidatePortal?.BaseUrl ?? DefaultBaseUrl).TrimEnd('/');
        var path = purpose?.ToUpperInvariant() switch
        {
            "QUIZ" => "quiz",
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
            "QUIZ" => ($"Mời làm bài kiểm tra — vị trí {jobTitle}",
                       $"Bạn được mời làm bài kiểm tra trực tuyến cho vị trí <b>{jobTitle}</b>. " +
                       "Nhấn nút bên dưới để bắt đầu.", "Làm bài kiểm tra"),
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
