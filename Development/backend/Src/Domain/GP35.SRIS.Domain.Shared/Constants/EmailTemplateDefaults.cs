namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>Chủ đề + nội dung khởi điểm của một loại email.</summary>
public record EmailTemplateSeed(string Type, string Name, string Subject, string Body);

/// <summary>
/// BỘ MẪU EMAIL DỰNG SẴN — công ty mới mở tài khoản là có ngay đủ mẫu, mở trang Mẫu Email
/// thấy nội dung thật để sửa, thay vì một bảng trống và phải tự viết HTML từ số 0.
///
/// Nguyên tắc: mẫu dựng sẵn chỉ chứa thứ hệ thống tự điền được ({{candidateName}},
/// {{jobTitle}}, {{link}}…). Thông tin riêng của từng công ty (giờ làm, chỗ gửi xe, nội quy)
/// để trong [ngoặc vuông] cho người tuyển dụng điền — và loại ONBOARDING sẽ KHÔNG tự gửi
/// chừng nào mẫu chưa được bật, để không ai nhận thư đầy "[điền địa chỉ]".
/// </summary>
public static class EmailTemplateDefaults
{
    /// <summary>Khối đầu thư dùng chung: logo + vạch màu brand.</summary>
    private const string Header = """
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{{jobTitle}} — {{companyName}}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
       style="background-color:#F4F4F4;margin:0;padding:24px 0;"><tr>
<td align="center" style="background-color:#F4F4F4;padding:0 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
       style="width:600px;max-width:600px;background-color:#FFFFFF;">
<tr><td align="center" style="background-color:#FFFFFF;padding:26px 34px 0 34px;">{{companyLogoImg}}</td></tr>
<tr><td style="background-color:#FFFFFF;padding:16px 34px 0 34px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="48" height="4" bgcolor="{{brandColor}}" style="font-size:0;line-height:0;">&nbsp;</td>
</tr></table></td></tr>
<tr><td style="background-color:#FFFFFF;padding:20px 34px 8px 34px;
       font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1F2933;">
""";

    private const string Footer = """
</td></tr>
<tr><td align="center" style="background-color:#FFFFFF;padding:18px 34px 28px 34px;
       font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#8A8F98;">
{{companyName}}
</td></tr>
</table></td></tr></table>
""";

    /// <summary>
    /// Nút bấm dựng bằng &lt;table&gt; chứ không dùng thẻ &lt;button&gt; — Outlook không render nút.
    /// Ghép chuỗi thường thay vì nội suy: thân nút chứa {{brandColor}}/{{link}} nên dùng raw
    /// string nội suy sẽ phải nhân đôi ngoặc, đọc rối và dễ sai.
    /// </summary>
    private static string Button(string label) =>
        "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:18px 0;\"><tr>" +
        "<td bgcolor=\"{{brandColor}}\" style=\"border-radius:4px;\">" +
        "<a href=\"{{link}}\" target=\"_blank\" style=\"display:inline-block;padding:11px 22px;" +
        "font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;" +
        "text-decoration:none;\">" + label + "</a>" +
        "</td></tr></table>";

    private static string Wrap(string inner) => Header + inner + Footer;

    /// <summary>Mọi loại email đều có mẫu sẵn, trừ OFFER_RESPONSE (thân thư do hệ thống dựng).</summary>
    public static IReadOnlyList<EmailTemplateSeed> All => new[]
    {
        new EmailTemplateSeed(EmailTemplateType.Schedule, "Mời chọn lịch phỏng vấn",
            "Mời bạn chọn lịch phỏng vấn — vị trí {{jobTitle}}",
            Wrap("""
<p style="margin:0 0 12px 0;">Chào <b>{{candidateName}}</b>,</p>
<p style="margin:0 0 12px 0;">Cảm ơn bạn đã ứng tuyển vị trí <b>{{jobTitle}}</b> tại {{companyName}}.
Chúng tôi muốn mời bạn tham gia buổi phỏng vấn.</p>
<p style="margin:0;">Bấm nút bên dưới để chọn khung giờ phù hợp với bạn:</p>
""" + Button("Chọn lịch phỏng vấn") + """
<p style="margin:0;">Liên kết có hiệu lực đến {{expiresAt}}.</p>
""")),

        new EmailTemplateSeed(EmailTemplateType.Status, "Tra cứu trạng thái hồ sơ",
            "Theo dõi hồ sơ ứng tuyển — vị trí {{jobTitle}}",
            Wrap("""
<p style="margin:0 0 12px 0;">Chào <b>{{candidateName}}</b>,</p>
<p style="margin:0 0 12px 0;">Chúng tôi đã nhận hồ sơ của bạn cho vị trí <b>{{jobTitle}}</b>.
Bạn có thể theo dõi tiến độ bất cứ lúc nào:</p>
""" + Button("Xem trạng thái hồ sơ") + """
<p style="margin:0;">Liên kết có hiệu lực đến {{expiresAt}}.</p>
""")),

        new EmailTemplateSeed(EmailTemplateType.InterviewConfirmed, "Xác nhận lịch phỏng vấn",
            "Xác nhận lịch phỏng vấn — vị trí {{jobTitle}}",
            Wrap("""
<p style="margin:0 0 12px 0;">Chào <b>{{candidateName}}</b>,</p>
<p style="margin:0 0 12px 0;">Buổi phỏng vấn vị trí <b>{{jobTitle}}</b> của bạn đã được xác nhận vào
lúc <b>{{startTime}}</b>.</p>
<p style="margin:0 0 12px 0;">File lịch (.ics) được đính kèm email này — mở để thêm vào ứng dụng lịch
của bạn. Hình thức phỏng vấn: [trực tiếp tại văn phòng / online — điền chi tiết].</p>
<p style="margin:0;">Nếu cần đổi lịch, vui lòng phản hồi email này sớm nhất có thể.</p>
""")),

        new EmailTemplateSeed(EmailTemplateType.InterviewCancelled, "Hủy lịch phỏng vấn",
            "Thay đổi lịch phỏng vấn — vị trí {{jobTitle}}",
            Wrap("""
<p style="margin:0 0 12px 0;">Chào <b>{{candidateName}}</b>,</p>
<p style="margin:0 0 12px 0;">Rất tiếc, buổi phỏng vấn vị trí <b>{{jobTitle}}</b> dự kiến lúc
<b>{{startTime}}</b> phải hủy. Lý do: {{reason}}</p>
<p style="margin:0;">Chúng tôi sẽ liên hệ để sắp xếp lịch mới trong thời gian sớm nhất. Mong bạn thông cảm.</p>
""")),

        new EmailTemplateSeed(EmailTemplateType.Hired, "Thông báo trúng tuyển",
            "Chúc mừng! Kết quả tuyển dụng vị trí {{jobTitle}}",
            Wrap("""
<p style="margin:0 0 12px 0;">Chào <b>{{candidateName}}</b>,</p>
<p style="margin:0 0 12px 0;">Chúc mừng bạn đã trúng tuyển vị trí <b>{{jobTitle}}</b> tại {{companyName}}!</p>
<p style="margin:0;">Bộ phận nhân sự sẽ gửi bạn hướng dẫn cho ngày làm việc đầu tiên trong email tiếp theo.</p>
""")),

        new EmailTemplateSeed(EmailTemplateType.Rejected, "Thông báo không trúng tuyển",
            "Kết quả ứng tuyển vị trí {{jobTitle}}",
            Wrap("""
<p style="margin:0 0 12px 0;">Chào <b>{{candidateName}}</b>,</p>
<p style="margin:0 0 12px 0;">Cảm ơn bạn đã quan tâm vị trí <b>{{jobTitle}}</b> tại {{companyName}}
và dành thời gian cho quá trình tuyển dụng vừa qua.</p>
<p style="margin:0 0 12px 0;">Rất tiếc lần này hồ sơ của bạn chưa phù hợp với vị trí. Chúng tôi sẽ lưu
hồ sơ và liên hệ khi có cơ hội phù hợp hơn.</p>
<p style="margin:0;">Chúc bạn sớm tìm được công việc như ý.</p>
""")),

        new EmailTemplateSeed(EmailTemplateType.Onboarding, "Chào mừng nhận việc (onboarding)",
            OnboardingEmailDefault.Subject, OnboardingEmailDefault.Body),
    };
}
