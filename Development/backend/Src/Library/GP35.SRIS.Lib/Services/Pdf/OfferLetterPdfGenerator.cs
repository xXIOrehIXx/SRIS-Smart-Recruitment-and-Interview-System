using System.Globalization;
using System.Text;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace GP35.SRIS.Lib.Services.Pdf;

/// <summary>
/// Sinh PDF thư mời nhận việc bằng QuestPDF (docs 5.15) — bám sát mẫu chuẩn:
/// đầu thư công ty → ngày → người nhận → chủ đề → lời mở → Thông tin vị trí →
/// Lương &amp; Phúc lợi → Điều khoản &amp; Điều kiện → hạn xác nhận → ký tên.
///
/// Font: Lato (QuestPDF nhúng sẵn trong package) — đã kiểm tra hiển thị đủ dấu tiếng Việt,
/// nên KHÔNG phụ thuộc font cài trên máy chủ (chạy được cả trên Linux container).
/// </summary>
public class OfferLetterPdfGenerator : IOfferLetterPdfGenerator
{
    private const string FontFamily = "Lato";
    private const string Bullet = "❖";

    private static readonly CultureInfo Vn = CultureInfo.GetCultureInfo("vi-VN");

    /// <summary>Điều khoản mặc định theo mẫu, dùng khi người soạn để trống ô "Điều khoản".</summary>
    public static readonly string DefaultTerms = string.Join('\n', new[]
    {
        "Việc làm của bạn sẽ tuân theo các điều khoản được quy định trong chính sách của công ty.",
        "Bạn có thể được yêu cầu ký thỏa thuận bảo mật và/hoặc điều khoản không cạnh tranh.",
        "Mỗi bên có thể chấm dứt thỏa thuận lao động theo chính sách của công ty và quy định pháp luật."
    });

    public byte[] Generate(OfferLetterModel m) => BuildDocument(m).GeneratePdf();

    /// <summary>
    /// Dựng document thư mời. Tách khỏi <see cref="Generate"/> để còn xuất được ra ảnh
    /// (<c>GenerateImages</c>) khi cần xem lại bố cục — kiểm tra bằng mắt thay vì đoán.
    /// </summary>
    public Document BuildDocument(OfferLetterModel m)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                // Lề + cỡ chữ đã căn để một lá thư đủ mục (6 dòng vị trí + 3 dòng lương +
                // 3 điều khoản + lời nhắn) vẫn gọn trong MỘT trang A4 — thư mời tràn sang
                // trang 2 chỉ để chứa mỗi chữ ký trông rất nghiệp dư.
                page.Margin(1.9f, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontFamily(FontFamily).FontSize(10.5f).LineHeight(1.28f));

                page.Content().Column(col =>
                {
                    col.Spacing(9);

                    ComposeLetterhead(col, m);
                    ComposeRecipient(col, m);
                    ComposeSubjectAndIntro(col, m);

                    ComposeSection(col, "Thông tin vị trí:", BuildPositionLines(m));
                    ComposeSection(col, "Lương & Phúc lợi:", BuildCompensationLines(m));
                    ComposeSection(col, "Điều khoản & Điều kiện:", BuildTermsLines(m));

                    ComposeClosing(col, m);
                    ComposeSignature(col, m);
                });

                // Số trang: thư 2 trang mà không đánh số thì rời tờ là mất thứ tự.
                page.Footer().AlignCenter().Text(t =>
                {
                    t.DefaultTextStyle(s => s.FontSize(9).FontColor(Colors.Grey.Darken1));
                    t.CurrentPageNumber();
                    t.Span(" / ");
                    t.TotalPages();
                });
            });
        });
    }

    public string BuildFileName(OfferLetterModel m)
    {
        var who = RemoveDiacritics(m.CandidateName ?? "ung-vien")
            .Replace(' ', '-');
        var safe = new string(who.Where(c => char.IsLetterOrDigit(c) || c == '-').ToArray()).Trim('-');
        if (string.IsNullOrEmpty(safe)) safe = "ung-vien";
        return $"Thu-moi-nhan-viec-{safe}.pdf";
    }

    // ============================================================
    // Các khối của lá thư
    // ============================================================

    private static void ComposeLetterhead(ColumnDescriptor col, OfferLetterModel m)
    {
        col.Item().Column(head =>
        {
            if (Has(m.CompanyName))
                head.Item().Text(m.CompanyName!).FontSize(15).Bold();
            if (Has(m.CompanyAddress))
                head.Item().Text(m.CompanyAddress!);

            // "email | điện thoại" — chỉ nối gạch khi có cả hai, tránh dòng "| 0900..." cụt đầu.
            var contact = string.Join("  |  ",
                new[] { m.CompanyEmail, m.CompanyPhone }.Where(Has)!);
            if (contact.Length > 0)
                head.Item().Text(contact);
        });

        col.Item().PaddingTop(4).LineHorizontal(1).LineColor(Colors.Grey.Lighten1);
        col.Item().Text($"Ngày {m.LetterDate:dd} tháng {m.LetterDate:MM} năm {m.LetterDate:yyyy}");
    }

    private static void ComposeRecipient(ColumnDescriptor col, OfferLetterModel m)
    {
        col.Item().Column(to =>
        {
            if (Has(m.CandidateName))
                to.Item().Text(m.CandidateName!).Bold();
            if (Has(m.CandidateAddress))
                to.Item().Text(m.CandidateAddress!);
        });
    }

    private static void ComposeSubjectAndIntro(ColumnDescriptor col, OfferLetterModel m)
    {
        var title = Has(m.JobTitle) ? m.JobTitle! : "vị trí ứng tuyển";

        col.Item().Text(t =>
        {
            t.Span("Chủ đề: ").Bold();
            t.Span($"Thư mời nhận việc cho vị trí {title}");
        });

        col.Item().Text($"Kính gửi {(Has(m.CandidateName) ? m.CandidateName : "Quý ứng viên")},");

        var company = Has(m.CompanyName) ? $" tại {m.CompanyName}" : "";
        col.Item().Text(
            $"Chúng tôi vui mừng thông báo và gửi lời mời bạn đảm nhận vị trí {title}{company}. " +
            "Sau khi xem xét trình độ, năng lực và kinh nghiệm của bạn, chúng tôi tin rằng bạn sẽ là " +
            "một thành viên có giá trị đối với đội ngũ của chúng tôi.")
            .Justify();
    }

    /// <summary>In 1 khối "tiêu đề + gạch đầu dòng". Không có dòng nào -> bỏ luôn cả khối.</summary>
    private static void ComposeSection(ColumnDescriptor col, string heading, IReadOnlyList<string> lines)
    {
        if (lines.Count == 0) return;

        col.Item().Column(section =>
        {
            section.Spacing(4);
            section.Item().Text(heading).Bold();

            foreach (var line in lines)
            {
                section.Item().PaddingLeft(14).Row(row =>
                {
                    row.ConstantItem(16).Text(Bullet);
                    row.RelativeItem().Text(line);
                });
            }
        });
    }

    private static void ComposeClosing(ColumnDescriptor col, OfferLetterModel m)
    {
        if (Has(m.Note))
            col.Item().Text(m.Note!).Justify();

        var deadline = m.AcceptanceDeadline is DateTime d
            ? $" trước ngày {d:dd/MM/yyyy}"
            : "";

        var hr = BuildHrContactPhrase(m);
        col.Item().Text(
            $"Vui lòng phản hồi xác nhận việc bạn đồng ý với lời mời nhận việc này{deadline}. " +
            $"Nếu có bất kỳ câu hỏi nào, vui lòng liên hệ {hr}.")
            .Justify();

        col.Item().Text("Chúng tôi rất vui mừng chào đón bạn gia nhập đội ngũ và mong được hợp tác cùng bạn!")
            .Justify();
    }

    private static void ComposeSignature(ColumnDescriptor col, OfferLetterModel m)
    {
        // ShowEntire: nếu buộc phải sang trang thì đẩy CẢ khối ký, không tách
        // "Trân trọng," ở cuối trang 1 còn tên người ký nằm trơ trên trang 2.
        col.Item().PaddingTop(6).ShowEntire().Column(sign =>
        {
            sign.Item().Text("Trân trọng,");
            sign.Item().PaddingTop(26).Column(who =>
            {
                if (Has(m.SignerName)) who.Item().Text(m.SignerName!).Bold();
                if (Has(m.SignerTitle)) who.Item().Text(m.SignerTitle!);
                if (Has(m.CompanyName)) who.Item().Text(m.CompanyName!);
            });
        });
    }

    // ============================================================
    // Dựng nội dung từng gạch đầu dòng
    // ============================================================

    private static List<string> BuildPositionLines(OfferLetterModel m)
    {
        var lines = new List<string>();
        AddIf(lines, "Vị trí công việc", m.JobTitle);
        AddIf(lines, "Phòng ban", m.Department);
        AddIf(lines, "Báo cáo cho", m.ReportingTo);
        if (m.StartDate is DateTime start)
            lines.Add($"Ngày bắt đầu: {start:dd/MM/yyyy}");
        AddIf(lines, "Hình thức làm việc", m.EmploymentType);
        AddIf(lines, "Địa điểm làm việc", m.WorkLocation);
        return lines;
    }

    private static List<string> BuildCompensationLines(OfferLetterModel m)
    {
        var lines = new List<string>();
        var salary = FormatSalary(m);
        if (salary is not null) lines.Add($"Mức lương: {salary}");
        AddIf(lines, "Thưởng/Ưu đãi", m.Bonus);
        AddIf(lines, "Các phúc lợi khác", m.Benefits);
        return lines;
    }

    private static List<string> BuildTermsLines(OfferLetterModel m)
    {
        var raw = Has(m.Terms) ? m.Terms! : DefaultTerms;
        return raw
            .Replace("\r\n", "\n")
            .Split('\n')
            .Select(l => l.Trim().TrimStart('-', '*', '•', '❖').Trim())
            .Where(l => l.Length > 0)
            .ToList();
    }

    /// <summary>"15.000.000 VND/tháng". Không nhập lương -> "Thỏa thuận" (vẫn in dòng cho rõ ràng).</summary>
    private static string? FormatSalary(OfferLetterModel m)
    {
        if (m.SalaryAmount is not decimal amount || amount <= 0)
            return "Thỏa thuận";

        var currency = Has(m.Currency) ? m.Currency!.Trim().ToUpperInvariant() : "VND";
        var period = (m.SalaryPeriod ?? "").Trim().ToUpperInvariant() switch
        {
            "NAM" => "/năm",
            "THANG" => "/tháng",
            _ => ""
        };
        return $"{amount.ToString("#,##0", Vn)} {currency}{period}";
    }

    private static void AddIf(ICollection<string> lines, string label, string? value)
    {
        if (Has(value)) lines.Add($"{label}: {value!.Trim()}");
    }

    private static string BuildHrContactPhrase(OfferLetterModel m)
    {
        var name = Has(m.HrContactName) ? m.HrContactName!.Trim() : null;
        var email = Has(m.HrContactEmail) ? m.HrContactEmail!.Trim()
                  : Has(m.CompanyEmail) ? m.CompanyEmail!.Trim()
                  : null;

        return (name, email) switch
        {
            (not null, not null) => $"{name} qua {email}",
            (not null, null) => name,
            (null, not null) => $"bộ phận nhân sự qua {email}",
            _ => "bộ phận nhân sự của chúng tôi"
        };
    }

    private static bool Has(string? s) => !string.IsNullOrWhiteSpace(s);

    /// <summary>Bỏ dấu tiếng Việt cho tên file (header Content-Disposition chỉ an toàn với ASCII).</summary>
    private static string RemoveDiacritics(string text)
    {
        var normalized = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString()
            .Normalize(NormalizationForm.FormC)
            .Replace('Đ', 'D')
            .Replace('đ', 'd');
    }
}
