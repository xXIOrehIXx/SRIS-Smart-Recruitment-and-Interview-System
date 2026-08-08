using System.Globalization;
using System.Net;
using System.Text;
using GP35.SRIS.Lib.Services.Pdf;

namespace GP35.SRIS.Lib.Services.Email;

/// <summary>
/// Dựng THÂN EMAIL của thư mời nhận việc — ứng viên mở hộp thư là đọc được luôn lá thư,
/// không phải bấm link hay tải file.
///
/// Dùng chung <see cref="OfferLetterModel"/> và <see cref="LetterPalette"/> với bản PDF nên
/// hai nơi không bao giờ nói khác nhau: sửa nội dung một chỗ là cả hai đổi theo.
///
/// <para><b>Viết theo luật HTML EMAIL:</b> bố cục &lt;table&gt;, CSS inline, khổ 600px,
/// preheader ẩn, khai báo MSO cho Outlook, mọi &lt;td&gt; đặt nền tường minh để dark mode
/// không đảo màu chữ, font web-safe. KHÔNG flexbox/grid/CSS variable — Outlook bỏ qua sạch.</para>
/// </summary>
public static class OfferLetterEmailBuilder
{
    private static readonly CultureInfo Vn = CultureInfo.GetCultureInfo("vi-VN");

    public static string BuildSubject(OfferLetterModel m) =>
        Has(m.JobTitle)
            ? $"Thư mời nhận việc — vị trí {m.JobTitle}"
            : "Thư mời nhận việc";

    public static string BuildHtml(OfferLetterModel m)
    {
        var p = LetterPalette.From(m.BrandColor);
        var sb = new StringBuilder(8000);

        var candidate = Has(m.CandidateName) ? E(m.CandidateName!) : "Quý ứng viên";
        var candidateAccent = $"<b style=\"color:{p.Frame};\">{candidate}</b>";
        var hasTitle = Has(m.JobTitle);
        // Thiếu tên vị trí thì bỏ hẳn cụm "vị trí ..." — nhét chữ thay thế vào sau chữ "vị trí"
        // đẻ ra câu "cho vị trí vị trí ứng tuyển" ngay trong thư gửi ứng viên.
        var position = hasTitle ? $"vị trí <b style=\"color:{p.Frame};\">{E(m.JobTitle!)}</b>"
                                : "vị trí bạn đã ứng tuyển";

        sb.Append("<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch>")
          .Append("</o:OfficeDocumentSettings></xml><![endif]-->");

        sb.Append("<div style=\"display:none;max-height:0;overflow:hidden;mso-hide:all;\">")
          .Append($"Thư mời nhận việc từ {E(m.CompanyName ?? "chúng tôi")}")
          .Append("</div>");

        sb.Append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" ")
          .Append("style=\"background-color:#F4F4F4;margin:0;padding:24px 0;\"><tr>")
          .Append("<td align=\"center\" style=\"background-color:#F4F4F4;padding:0 12px;\">");

        // Khung thư: viền màu brand + nền giấy — cùng ngôn ngữ thị giác với bản in.
        sb.Append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"600\" ")
          .Append($"style=\"width:600px;max-width:600px;background-color:{p.Paper};")
          .Append($"border:1px solid {p.Frame};\">");

        // ----- Banner logo (canh giữa, ngay trên tiêu đề) -----
        if (Has(m.CompanyLogoUrl))
            sb.Append(Row(p, "padding:26px 34px 0 34px;",
                $"<div style=\"text-align:center;\"><img src=\"{E(m.CompanyLogoUrl!)}\" " +
                $"alt=\"{E(m.CompanyName ?? "")}\" style=\"display:inline-block;border:0;height:auto;" +
                "max-height:64px;max-width:320px;\"></div>"));

        // ----- Đầu thư: tên/địa chỉ/liên hệ công ty -----
        sb.Append(Row(p, Has(m.CompanyLogoUrl) ? "padding:18px 34px 0 34px;" : "padding:28px 34px 0 34px;",
            Letterhead(m, p)));

        // ----- Tiêu đề -----
        sb.Append(Row(p, "padding:22px 34px 0 34px;",
            $"<div style=\"text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:22px;" +
            $"font-weight:800;letter-spacing:0.5px;color:{p.Frame};\">THƯ MỜI NHẬN VIỆC</div>"));

        // ----- Ngày + người nhận -----
        sb.Append(Row(p, "padding:20px 34px 0 34px;",
            Text($"Ngày {m.LetterDate:dd} tháng {m.LetterDate:MM} năm {m.LetterDate:yyyy}") +
            $"<div style=\"height:10px;line-height:10px;\">&nbsp;</div>" +
            Text(candidateAccent) +
            (Has(m.CandidateAddress) ? Text(E(m.CandidateAddress!)) : "")));

        // ----- Chủ đề + lời mở -----
        var company = Has(m.CompanyName) ? $" tại <b>{E(m.CompanyName!)}</b>" : "";
        sb.Append(Row(p, "padding:16px 34px 0 34px;",
            Text(hasTitle
                    ? $"<b>Chủ đề:</b> Thư mời nhận việc cho vị trí {E(m.JobTitle!)}"
                    : "<b>Chủ đề:</b> Thư mời nhận việc") +
            "<div style=\"height:10px;line-height:10px;\">&nbsp;</div>" +
            Text($"Kính gửi {candidateAccent}, chúng tôi vui mừng thông báo và gửi lời mời bạn đảm nhận " +
                 $"{position}{company}. Sau khi xem xét trình độ, năng lực và kinh nghiệm của bạn, " +
                 "chúng tôi tin rằng bạn sẽ là một thành viên có giá trị đối với đội ngũ của chúng tôi.")));

        // ----- 3 khối nội dung -----
        sb.Append(Section(p, "Thông tin vị trí", PositionLines(m)));
        sb.Append(Section(p, "Lương & Phúc lợi", CompensationLines(m)));
        sb.Append(Section(p, "Điều khoản & Điều kiện", TermsLines(m)));

        // ----- Lời kết -----
        var deadline = m.AcceptanceDeadline is DateTime d
            ? $" <b style=\"color:{p.Accent};\">trước ngày {d:dd/MM/yyyy}</b>"
            : "";
        var closing = new StringBuilder();
        if (Has(m.Note)) closing.Append(Text(E(m.Note!))).Append("<div style=\"height:10px;\">&nbsp;</div>");
        closing.Append(Text(
            $"Vui lòng phản hồi email này để xác nhận bạn đồng ý với lời mời nhận việc{deadline}. " +
            $"Nếu có bất kỳ câu hỏi nào, vui lòng liên hệ {HrContact(m, p)}."));
        closing.Append("<div style=\"height:10px;\">&nbsp;</div>");
        closing.Append(Text("Chúng tôi rất vui mừng chào đón bạn gia nhập đội ngũ và mong được hợp tác cùng bạn!"));
        sb.Append(Row(p, "padding:20px 34px 0 34px;", closing.ToString()));

        // ----- Ký tên -----
        var sign = new StringBuilder(
            $"<div style=\"border-top:2px solid {p.Frame};margin-bottom:16px;font-size:0;line-height:0;\">&nbsp;</div>"
            + Text("Trân trọng,") + "<div style=\"height:14px;\">&nbsp;</div>");
        if (Has(m.SignerName)) sign.Append(Text($"<b>{E(m.SignerName!)}</b>"));
        if (Has(m.SignerTitle)) sign.Append(Text(E(m.SignerTitle!)));
        if (Has(m.CompanyName)) sign.Append(Text(E(m.CompanyName!)));
        sb.Append(Row(p, "padding:20px 34px 30px 34px;", sign.ToString()));

        sb.Append("</table></td></tr></table>");
        return sb.ToString();
    }

    // ============================================================

    private static string Letterhead(OfferLetterModel m, LetterPalette p)
    {
        var sb = new StringBuilder();

        if (Has(m.CompanyName))
            sb.Append($"<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;")
              .Append($"line-height:1.35;color:{p.Heading};\">{E(m.CompanyName!)}</div>");
        if (Has(m.CompanyAddress))
            sb.Append(Small(E(m.CompanyAddress!)));

        var contact = string.Join(" | ", new[] { m.CompanyEmail, m.CompanyPhone }.Where(Has).Select(x => E(x!)));
        if (contact.Length > 0) sb.Append(Small(contact));

        sb.Append($"<div style=\"border-top:2px solid {p.Frame};margin-top:12px;font-size:0;line-height:0;\">&nbsp;</div>");
        return sb.ToString();
    }

    /// <summary>1 khối "tiêu đề đậm + các dòng ❖". Không có dòng nào -> bỏ luôn cả khối.</summary>
    private static string Section(LetterPalette p, string heading, IReadOnlyList<string> lines)
    {
        if (lines.Count == 0) return "";

        var sb = new StringBuilder();
        sb.Append($"<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;")
          .Append($"color:{p.Heading};margin-bottom:6px;\">{heading}:</div>");

        sb.Append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\">");
        foreach (var line in lines)
        {
            sb.Append("<tr>")
              .Append($"<td width=\"22\" valign=\"top\" style=\"font-family:Arial,Helvetica,sans-serif;")
              .Append($"font-size:13px;line-height:1.55;color:{p.Frame};padding-left:6px;\">&#10022;</td>")
              .Append("<td style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;")
              .Append($"color:{p.Body};padding-bottom:3px;\">{line}</td>")
              .Append("</tr>");
        }
        sb.Append("</table>");

        return Row(p, "padding:18px 34px 0 34px;", sb.ToString());
    }

    private static List<string> PositionLines(OfferLetterModel m)
    {
        var lines = new List<string>();
        AddIf(lines, "Vị trí công việc", m.JobTitle);
        AddIf(lines, "Phòng ban", m.Department);
        AddIf(lines, "Báo cáo cho", m.ReportingTo);
        if (m.StartDate is DateTime start) lines.Add($"<b>Ngày bắt đầu:</b> {start:dd/MM/yyyy}");
        AddIf(lines, "Hình thức làm việc", m.EmploymentType);
        AddIf(lines, "Địa điểm làm việc", m.WorkLocation);
        return lines;
    }

    private static List<string> CompensationLines(OfferLetterModel m)
    {
        var lines = new List<string> { $"<b>Mức lương:</b> {E(FormatSalary(m))}" };
        AddIf(lines, "Thưởng/Ưu đãi", m.Bonus);
        AddIf(lines, "Các phúc lợi khác", m.Benefits);
        return lines;
    }

    private static List<string> TermsLines(OfferLetterModel m)
    {
        var raw = Has(m.Terms) ? m.Terms! : OfferLetterPdfGenerator.DefaultTerms;
        return raw.Replace("\r\n", "\n").Split('\n')
            .Select(l => l.Trim().TrimStart('-', '*', '•', '❖').Trim())
            .Where(l => l.Length > 0)
            .Select(E)
            .ToList();
    }

    /// <summary>"15.000.000 VND/tháng". Không nhập lương -> "Thỏa thuận" (vẫn in dòng cho rõ ràng).</summary>
    private static string FormatSalary(OfferLetterModel m)
    {
        if (m.SalaryAmount is not decimal amount || amount <= 0) return "Thỏa thuận";

        var currency = Has(m.Currency) ? m.Currency!.Trim().ToUpperInvariant() : "VND";
        var period = (m.SalaryPeriod ?? "").Trim().ToUpperInvariant() switch
        {
            "NAM" => "/năm",
            "THANG" => "/tháng",
            _ => ""
        };
        return $"{amount.ToString("#,##0", Vn)} {currency}{period}";
    }

    private static string HrContact(OfferLetterModel m, LetterPalette p)
    {
        var name = Has(m.HrContactName) ? E(m.HrContactName!.Trim()) : null;
        var email = Has(m.HrContactEmail) ? m.HrContactEmail!.Trim()
                  : Has(m.CompanyEmail) ? m.CompanyEmail!.Trim()
                  : null;
        var mailto = email is null ? null
            : $"<a href=\"mailto:{E(email)}\" style=\"color:{p.Frame};text-decoration:underline;\">{E(email)}</a>";

        return (name, mailto) switch
        {
            (not null, not null) => $"{name} qua {mailto}",
            (not null, null) => name,
            (null, not null) => $"bộ phận nhân sự qua {mailto}",
            _ => "bộ phận nhân sự của chúng tôi"
        };
    }

    private static void AddIf(ICollection<string> lines, string label, string? value)
    {
        if (Has(value)) lines.Add($"<b>{label}:</b> {E(value!.Trim())}");
    }

    // ----- mảnh HTML dùng lại -----

    private static string Row(LetterPalette p, string padding, string inner) =>
        $"<tr><td style=\"background-color:{p.Paper};{padding}\">{inner}</td></tr>";

    private static string Text(string html) =>
        $"<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1F2933;\">{html}</div>";

    private static string Small(string html) =>
        $"<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.45;color:#5A6472;\">{html}</div>";

    private static bool Has(string? s) => !string.IsNullOrWhiteSpace(s);

    /// <summary>Escape dữ liệu người dùng nhập — tên/địa chỉ có ký tự &amp; hay &lt; là vỡ layout email.</summary>
    private static string E(string s) => WebUtility.HtmlEncode(s);
}
