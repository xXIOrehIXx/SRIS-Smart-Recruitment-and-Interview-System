using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Lib.Services;
using GP35.SRIS.Lib.Services.Email;
using GP35.SRIS.Lib.Services.Pdf;
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

    /// <summary>Màu nhấn khi công ty chưa cấu hình brand (cùng tông với thư mời PDF).</summary>
    private const string DefaultBrandColor = "#1CA0E3";
    private const int InterviewDurationMinutes = 60; // schema chưa lưu end_time -> dùng độ dài mặc định

    private readonly IApplicationRepo _appRepo;
    private readonly IEmailTemplateRepo _templateRepo;
    private readonly ICompanyRepo _companyRepo;
    private readonly IOfferRepo _offerRepo;
    private readonly IEmailService _email;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public NotificationService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _templateRepo = serviceProvider.GetRequiredService<IEmailTemplateRepo>();
        _companyRepo = serviceProvider.GetRequiredService<ICompanyRepo>();
        _offerRepo = serviceProvider.GetRequiredService<IOfferRepo>();
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
            var placeholders = await BrandPlaceholdersAsync(companyId);
            placeholders["candidateName"] = info.CandidateName ?? "";
            placeholders["jobTitle"] = info.JobTitle ?? "";
            placeholders["link"] = link;
            placeholders["expiresAt"] = expiresText;

            string subject, body;

            // Thư mời nhận việc: THÂN EMAIL chính là lá thư — ứng viên mở hộp thư là đọc được
            // ngay trên điện thoại, không phải bấm link hay tải file (5.15).
            var letter = string.Equals(purpose, EmailTemplateType.OfferResponse, StringComparison.OrdinalIgnoreCase)
                ? await TryBuildLetterModelAsync(companyId, applicationId)
                : null;

            // Có dữ liệu thư mời -> mở thêm các ô {{positionBlock}}, {{compensationBlock}}...
            // để công ty tự viết lời thư trong trang Mẫu email mà số liệu vẫn do code dựng.
            if (letter is not null) AddOfferLetterPlaceholders(placeholders, letter);

            var rendered = await TryRenderTemplateAsync(companyId, purpose, placeholders);
            if (rendered is null && letter is not null)
            {
                subject = OfferLetterEmailBuilder.BuildSubject(letter);
                body = OfferLetterEmailBuilder.BuildHtml(letter);
            }
            else if (rendered is not null)
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

            // KHÔNG đính kèm file: thư mời nằm ngay trong thân email, ứng viên đọc và bấm
            // Reply để trả lời. Kèm thêm một bản PDF y hệt chỉ làm nặng hộp thư và dễ bị bộ
            // lọc thư rác soi. Ai cần bản để lưu/in thì tải trong Portal.
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

            var placeholders = await BrandPlaceholdersAsync(companyId);
            placeholders["candidateName"] = info.CandidateName ?? "";
            placeholders["jobTitle"] = info.JobTitle ?? "";

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

    public async Task SendOnboardingAsync(long companyId, long applicationId)
    {
        try
        {
            var info = await _appRepo.GetContactInfoAsync(companyId, applicationId);
            if (info is null || string.IsNullOrWhiteSpace(info.CandidateEmail)) return;

            var company = await _companyRepo.GetByCompanyId(companyId);
            var offer = await _offerRepo.GetByApplicationAsync(companyId, applicationId);

            var placeholders = await BrandPlaceholdersAsync(companyId);
            placeholders["candidateName"] = info.CandidateName ?? "";
            placeholders["jobTitle"] = offer?.JobTitle ?? info.JobTitle ?? "";
            // Ngày vào làm lấy từ thư mời đã gửi; chưa có thì để người tuyển dụng tự điền
            // trong mẫu, KHÔNG in ngày bịa.
            placeholders["startDate"] = offer?.StartDate is DateTime d ? d.ToString("dd/MM/yyyy") : "[ngày vào làm]";
            placeholders["companyAddress"] = company?.Address ?? "[địa chỉ văn phòng]";
            placeholders["hrEmail"] = offer?.HrContactEmail ?? company?.ContactEmail ?? "";
            // Tên miền email nội bộ (V017) — dòng "cấp email @công-ty.com" trong mẫu.
            placeholders["emailDomain"] = Has(company?.EmailDomain) ? company!.EmailDomain! : "[tên miền công ty]";

            // Không có mẫu ACTIVE -> KHÔNG gửi. Mẫu mặc định đầy chỗ "[điền...]" chỉ để làm
            // khung soạn thảo, gửi thẳng cho ứng viên thì phản tác dụng.
            var rendered = await TryRenderTemplateAsync(companyId, EmailTemplateType.Onboarding, placeholders);
            if (rendered is null)
            {
                _logger.Information(
                    "Notify: công ty {CompanyId} chưa bật mẫu ONBOARDING — bỏ qua email onboarding (app={AppId}).",
                    companyId, applicationId);
                return;
            }

            await _email.SendEmailAsync(rendered.Value.Subject, rendered.Value.Body, info.CandidateEmail, string.Empty);
            _logger.Information("Notify: gửi email onboarding cho {Email} (app={AppId}).",
                info.CandidateEmail, applicationId);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Notify: lỗi gửi email onboarding (app={AppId}) — bỏ qua (best-effort).",
                applicationId);
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
            var placeholders = await BrandPlaceholdersAsync(companyId);
            placeholders["candidateName"] = info.CandidateName ?? "";
            placeholders["jobTitle"] = info.JobTitle ?? "";
            placeholders["startTime"] = startText;
            placeholders["link"] = gcalUrl;

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

            var placeholders = await BrandPlaceholdersAsync(companyId);
            placeholders["candidateName"] = info.CandidateName ?? "";
            placeholders["jobTitle"] = info.JobTitle ?? "";
            placeholders["startTime"] = startText;
            placeholders["reason"] = reasonText;

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

            // Người tuyển dụng chỉ soạn RUỘT thư; vỏ (logo + vạch brand + chân trang) bọc ở đây.
            // Ai lỡ dán nguyên một email hoàn chỉnh thì EmailLayout tự nhận ra và không bọc chồng.
            var body = EmailLayout.Wrap(template.Body);
            var renderedSubject = Render(template.Subject, placeholders);
            var renderedBody = Render(body, placeholders);

            WarnLeftoverPlaceholders(type, renderedSubject, renderedBody);
            return (renderedSubject, renderedBody);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "Notify: lỗi tra template '{Type}' — dùng nội dung mặc định.", type);
            return null;
        }
    }

    /// <summary>
    /// Ba ô brand mà VỎ email (<see cref="EmailLayout"/>) luôn dùng, nên MỌI loại email đều
    /// phải có — kể cả loại mà ruột thư không nhắc tới chúng.
    ///
    /// <para>Đây từng là bẫy: mỗi hàm Send* tự dựng dictionary riêng, hàm nào quên 3 ô này thì
    /// vỏ thư không thay được và ứng viên nhận nguyên chuỗi "{{companyLogoImg}}" ở đầu thư
    /// (email trúng tuyển / hủy lịch / xác nhận lịch đều từng dính). Giờ mọi hàm bắt đầu từ
    /// đây rồi mới thêm ô riêng của mình.</para>
    /// </summary>
    private async Task<Dictionary<string, string>> BrandPlaceholdersAsync(long companyId)
    {
        var company = await _companyRepo.GetByCompanyId(companyId);
        return new Dictionary<string, string>
        {
            ["companyName"] = company?.Name ?? "",
            ["brandColor"] = Has(company?.PrimaryColor) ? company!.PrimaryColor! : DefaultBrandColor,
            ["companyLogoImg"] = BuildLogoImg(company?.LogoUrl, company?.Name)
        };
    }

    /// <summary>
    /// Kêu lên khi thư gửi đi vẫn còn <c>{{ô}}</c> chưa thay — nghĩa là mẫu dùng một ô không
    /// tồn tại ở loại email đó (vd đặt {{salary}} vào mẫu Hủy lịch phỏng vấn), và ứng viên sẽ
    /// nhận được đúng chuỗi "{{salary}}" trong thư. Chỉ cảnh báo, KHÔNG chặn gửi: mẫu sai một ô
    /// không đáng để nuốt cả email.
    /// </summary>
    private void WarnLeftoverPlaceholders(string type, string subject, string body)
    {
        var leftovers = System.Text.RegularExpressions.Regex
            .Matches(subject + " " + body, @"\{\{\s*(\w+)\s*\}\}")
            .Select(m => m.Groups[1].Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (leftovers.Length > 0)
            _logger.Warning("Notify: mẫu '{Type}' còn ô chưa thay được: {Placeholders} — thư gửi đi " +
                            "sẽ hiện nguyên chuỗi đó.", type, string.Join(", ", leftovers));
    }

    /// <summary>
    /// Mở các ô riêng của thư mời nhận việc cho mẫu email OFFER_RESPONSE.
    ///
    /// <para>Mấy ô <c>*Block</c> là HTML nguyên khối do code dựng (bảng ✦, đã bỏ dòng rỗng, đã
    /// format tiền và ngày). Cố ý KHÔNG tách thành {{salaryAmount}}, {{bonus}}, {{benefits}}…
    /// rời: engine template ở đây chỉ thay chuỗi, không có "nếu trống thì bỏ dòng", nên ô rời
    /// nào bỏ trống là ứng viên nhận được một dòng cụt trong văn bản chính thức.</para>
    /// </summary>
    private static void AddOfferLetterPlaceholders(
        IDictionary<string, string> placeholders, OfferLetterModel letter)
    {
        placeholders["letterhead"] = OfferLetterEmailBuilder.BuildLetterhead(letter);
        placeholders["positionBlock"] = OfferLetterEmailBuilder.BuildPositionBlock(letter);
        placeholders["compensationBlock"] = OfferLetterEmailBuilder.BuildCompensationBlock(letter);
        placeholders["termsBlock"] = OfferLetterEmailBuilder.BuildTermsBlock(letter);
        placeholders["signature"] = OfferLetterEmailBuilder.BuildSignature(letter);

        placeholders["letterDate"] = OfferLetterEmailBuilder.BuildLetterDate(letter);
        placeholders["acceptanceDeadline"] = OfferLetterEmailBuilder.BuildAcceptanceDeadline(letter);
        placeholders["hrContact"] = OfferLetterEmailBuilder.BuildHrContact(letter);
        placeholders["salary"] = OfferLetterEmailBuilder.BuildSalary(letter);

        // {{jobTitle}} của luồng magic link lấy từ Job; thư mời cho phép sửa lại tên vị trí
        // ngay trên form -> ưu tiên tên đã chốt trong thư, tránh email nói khác lá thư.
        if (!string.IsNullOrWhiteSpace(letter.JobTitle)) placeholders["jobTitle"] = letter.JobTitle!;
    }

    /// <summary>Gom OfferDetail + Company + tên ứng viên thành dữ liệu in thư. Null = chưa có offer.</summary>
    private async Task<OfferLetterModel?> TryBuildLetterModelAsync(long companyId, long applicationId)
    {
        try
        {
            var offer = await _offerRepo.GetByApplicationAsync(companyId, applicationId);
            if (offer is null) return null;

            var info = await _appRepo.GetContactInfoAsync(companyId, applicationId);
            var company = await _companyRepo.GetByCompanyId(companyId);
            return OfferService.BuildLetterModel(offer, company, info?.CandidateName);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "Notify: không dựng được dữ liệu thư mời (app={AppId}).", applicationId);
            return null;
        }
    }

    /// <summary>
    /// Thẻ &lt;img&gt; logo công ty cho thân email. Chưa cấu hình logo -> trả chuỗi RỖNG chứ
    /// không phải &lt;img src=""&gt;, tránh ô ảnh vỡ chình ình ở đầu thư.
    /// </summary>
    private static string BuildLogoImg(string? logoUrl, string? companyName) =>
        Has(logoUrl)
            ? $"<img src=\"{logoUrl}\" alt=\"{companyName}\" " +
              "style=\"display:inline-block;border:0;height:auto;max-height:64px;max-width:320px;\">"
            : "";

    private static bool Has(string? s) => !string.IsNullOrWhiteSpace(s);

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
            "OFFER_RESPONSE" => "offer",
            "STATUS" => "status",
            _ => "candidate"
        };
        return $"{baseUrl}/{path}?token={Uri.EscapeDataString(rawToken)}";
    }

    private static (string Subject, string Intro, string Button) MagicLinkContent(string purpose, string jobTitle)
        => purpose?.ToUpperInvariant() switch
        {
            // 5.15: link mở thẳng file PDF thư mời — ứng viên KHÔNG bấm đồng ý/từ chối trong
            // hệ thống nữa, nên lời email phải mời họ trả lời lại email/HR, không mời "phản hồi".
            "OFFER_RESPONSE" => ($"Thư mời nhận việc — vị trí {jobTitle}",
                       $"Chúc mừng! Bạn đã vượt qua vòng phỏng vấn vị trí <b>{jobTitle}</b>. " +
                       "Chúng tôi trân trọng gửi bạn thư mời nhận việc kèm theo — nhấn nút bên dưới " +
                       "để xem và tải bản PDF.<br><br>" +
                       "Sau khi xem thư, vui lòng phản hồi lại email này để xác nhận bạn có nhận " +
                       "lời mời hay không. Mọi thắc mắc về nội dung thư, bạn cứ trao đổi trực tiếp " +
                       "với bộ phận tuyển dụng của chúng tôi.", "Xem thư mời nhận việc (PDF)"),
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
