namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>Chủ đề + nội dung khởi điểm của một loại email.</summary>
public record EmailTemplateSeed(string Type, string Name, string Subject, string Body);

/// <summary>
/// BỘ MẪU EMAIL DỰNG SẴN — công ty mới mở tài khoản là có ngay đủ mẫu, mở trang Mẫu Email
/// thấy nội dung thật để sửa, thay vì bảng trống.
///
/// <para><b>Body ở đây chỉ là RUỘT thư</b> (đoạn văn, danh sách, link) — logo, vạch màu brand
/// và chân trang do <see cref="EmailLayout"/> bọc lúc gửi. Nhờ vậy người tuyển dụng soạn thư
/// trong ô soạn thảo giàu định dạng mà không thấy — và không làm vỡ — khung HTML của email.</para>
///
/// Thông tin riêng của từng công ty (giờ làm, chỗ gửi xe, nội quy) để trong [ngoặc vuông];
/// riêng ONBOARDING seed ở trạng thái TẮT để không ai nhận thư còn nguyên chỗ trống.
/// </summary>
public static class EmailTemplateDefaults
{
    /// <summary>Nút bấm dựng bằng &lt;table&gt; — Outlook không render thẻ &lt;button&gt;.</summary>
    private static string Button(string label) =>
        "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:18px 0;\"><tr>" +
        "<td bgcolor=\"{{brandColor}}\" style=\"border-radius:4px;\">" +
        "<a href=\"{{link}}\" target=\"_blank\" style=\"display:inline-block;padding:11px 22px;" +
        "font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:#FFFFFF;" +
        "text-decoration:none;\">" + label + "</a>" +
        "</td></tr></table>";

    public static IReadOnlyList<EmailTemplateSeed> All => new[]
    {
        new EmailTemplateSeed(EmailTemplateType.Schedule, "Mời chọn lịch phỏng vấn",
            "Mời bạn chọn lịch phỏng vấn — vị trí {{jobTitle}}",
            """
<p>Chào <b>{{candidateName}}</b>,</p>
<p>Cảm ơn bạn đã ứng tuyển vị trí <b>{{jobTitle}}</b> tại {{companyName}}. Chúng tôi muốn mời bạn
tham gia buổi phỏng vấn.</p>
<p>Bấm nút bên dưới để chọn khung giờ phù hợp với bạn:</p>
""" + Button("Chọn lịch phỏng vấn") + """
<p>Liên kết có hiệu lực đến {{expiresAt}}.</p>
"""),

        new EmailTemplateSeed(EmailTemplateType.Status, "Tra cứu trạng thái hồ sơ",
            "Theo dõi hồ sơ ứng tuyển — vị trí {{jobTitle}}",
            """
<p>Chào <b>{{candidateName}}</b>,</p>
<p>Chúng tôi đã nhận hồ sơ của bạn cho vị trí <b>{{jobTitle}}</b>. Bạn có thể theo dõi tiến độ
bất cứ lúc nào:</p>
""" + Button("Xem trạng thái hồ sơ") + """
<p>Liên kết có hiệu lực đến {{expiresAt}}.</p>
"""),

        new EmailTemplateSeed(EmailTemplateType.InterviewConfirmed, "Xác nhận lịch phỏng vấn",
            "Xác nhận lịch phỏng vấn — vị trí {{jobTitle}}",
            """
<p>Chào <b>{{candidateName}}</b>,</p>
<p>Buổi phỏng vấn vị trí <b>{{jobTitle}}</b> của bạn đã được xác nhận vào lúc <b>{{startTime}}</b>.</p>
<p>File lịch (.ics) được đính kèm email này — mở để thêm vào ứng dụng lịch của bạn.
Hình thức phỏng vấn: [trực tiếp tại văn phòng / online — điền chi tiết].</p>
<p>Nếu cần đổi lịch, vui lòng phản hồi email này sớm nhất có thể.</p>
"""),

        new EmailTemplateSeed(EmailTemplateType.InterviewCancelled, "Hủy lịch phỏng vấn",
            "Thay đổi lịch phỏng vấn — vị trí {{jobTitle}}",
            """
<p>Chào <b>{{candidateName}}</b>,</p>
<p>Rất tiếc, buổi phỏng vấn vị trí <b>{{jobTitle}}</b> dự kiến lúc <b>{{startTime}}</b> phải hủy.
Lý do: {{reason}}</p>
<p>Chúng tôi sẽ liên hệ để sắp xếp lịch mới trong thời gian sớm nhất. Mong bạn thông cảm.</p>
"""),

        new EmailTemplateSeed(EmailTemplateType.Hired, "Thông báo trúng tuyển",
            "Chúc mừng! Kết quả tuyển dụng vị trí {{jobTitle}}",
            """
<p>Chào <b>{{candidateName}}</b>,</p>
<p>Chúc mừng bạn đã trúng tuyển vị trí <b>{{jobTitle}}</b> tại {{companyName}}!</p>
<p>Bộ phận nhân sự sẽ gửi bạn hướng dẫn cho ngày làm việc đầu tiên trong email tiếp theo.</p>
"""),

        new EmailTemplateSeed(EmailTemplateType.Rejected, "Thông báo không trúng tuyển",
            "Kết quả ứng tuyển vị trí {{jobTitle}}",
            """
<p>Chào <b>{{candidateName}}</b>,</p>
<p>Cảm ơn bạn đã quan tâm vị trí <b>{{jobTitle}}</b> tại {{companyName}} và dành thời gian cho
quá trình tuyển dụng vừa qua.</p>
<p>Rất tiếc lần này hồ sơ của bạn chưa phù hợp với vị trí. Chúng tôi sẽ lưu hồ sơ và liên hệ khi
có cơ hội phù hợp hơn.</p>
<p>Chúc bạn sớm tìm được công việc như ý.</p>
"""),

        new EmailTemplateSeed(EmailTemplateType.Onboarding, "Chào mừng nhận việc (onboarding)",
            OnboardingEmailDefault.Subject, OnboardingEmailDefault.Body),
    };
}
