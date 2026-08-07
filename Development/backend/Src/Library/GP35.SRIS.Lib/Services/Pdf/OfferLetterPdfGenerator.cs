using System.Globalization;
using System.Text;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace GP35.SRIS.Lib.Services.Pdf;

/// <summary>
/// Sinh PDF thư mời nhận việc bằng QuestPDF (docs 5.15) — bám sát mẫu chuẩn:
/// đầu thư công ty (logo + brand) → ngày → tiêu đề → người nhận → lời mở →
/// Thông tin vị trí → Lương &amp; Phúc lợi → Điều khoản &amp; Điều kiện → hạn xác nhận → ký tên.
///
/// Màu sắc lấy từ <c>Company.primary_color</c> qua <see cref="LetterPalette"/> nên mỗi tenant
/// ra một lá thư mang màu của chính họ; công ty chưa cấu hình brand vẫn được navy mặc định.
///
/// Font: Lato (QuestPDF nhúng sẵn trong package) — đã kiểm tra hiển thị đủ dấu tiếng Việt,
/// nên KHÔNG phụ thuộc font cài trên máy chủ (chạy được cả trên Linux container).
/// </summary>
public class OfferLetterPdfGenerator : IOfferLetterPdfGenerator
{
    private const string FontFamily = "Lato";

    private static readonly CultureInfo Vn = CultureInfo.GetCultureInfo("vi-VN");

    /// <summary>Điều khoản mặc định theo mẫu, dùng khi người soạn để trống ô "Điều khoản".</summary>
    public static readonly string DefaultTerms = string.Join('\n', new[]
    {
        "Việc làm của bạn sẽ tuân theo các điều khoản được quy định trong chính sách của công ty.",
        "Bạn có thể được yêu cầu ký thỏa thuận bảo mật và/hoặc điều khoản không cạnh tranh.",
        "Mỗi bên có thể chấm dứt thỏa thuận lao động theo chính sách của công ty và quy định pháp luật."
    });

    public byte[] Generate(OfferLetterModel m)
    {
        try
        {
            return BuildDocument(m).GeneratePdf();
        }
        catch (Exception) when (m.LogoBytes is not null)
        {
            // File logo lạ (đúng magic bytes nhưng hỏng ruột) làm QuestPDF ném lúc render.
            // Thà mất logo còn hơn ứng viên bấm tải thư mời và nhận về lỗi 500.
            m.LogoBytes = null;
            return BuildDocument(m).GeneratePdf();
        }
    }

    /// <summary>
    /// Dựng document thư mời. Tách khỏi <see cref="Generate"/> để còn xuất được ra ảnh
    /// (<c>GenerateImages</c>) khi cần xem lại bố cục — kiểm tra bằng mắt thay vì đoán.
    /// </summary>
    public Document BuildDocument(OfferLetterModel m)
    {
        var p = LetterPalette.From(m.BrandColor);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                // Lề + cỡ chữ đã căn để một lá thư đủ mục (6 dòng vị trí + 3 dòng lương +
                // 3 điều khoản + lời nhắn) vẫn gọn trong MỘT trang A4 — thư mời tràn sang
                // trang 2 chỉ để chứa mỗi chữ ký trông rất nghiệp dư.
                page.Margin(1.9f, Unit.Centimetre);
                page.MarginTop(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontFamily(FontFamily).FontSize(10.5f)
                    .LineHeight(1.28f).FontColor(p.Body));

                // Dải màu tràn mép trên: nằm ở lớp Background nên không ăn vào lề nội dung.
                page.Background().Column(bg =>
                {
                    bg.Item().Height(9).Background(p.Accent);
                    bg.Item().Extend();
                });

                page.Content().Column(col =>
                {
                    col.Spacing(9);

                    ComposeLetterhead(col, m, p);
                    ComposeTitle(col, m, p);
                    ComposeRecipient(col, m, p);
                    ComposeIntro(col, m);

                    ComposeFields(col, "THÔNG TIN VỊ TRÍ", BuildPositionFields(m), p, highlight: false);
                    ComposeFields(col, "LƯƠNG & PHÚC LỢI", BuildCompensationFields(m), p, highlight: true);
                    ComposeBullets(col, "ĐIỀU KHOẢN & ĐIỀU KIỆN", BuildTermsLines(m), p);

                    ComposeClosing(col, m);
                    ComposeSignature(col, m, p);
                });

                // Chân trang: tên công ty + số trang. Thư 2 trang mà không đánh số thì rời tờ là mất thứ tự.
                page.Footer().Column(foot =>
                {
                    foot.Item().PaddingBottom(5).LineHorizontal(0.6f).LineColor(p.SoftLine);
                    foot.Item().Row(row =>
                    {
                        row.RelativeItem().Text(m.CompanyName ?? "")
                            .FontSize(8).FontColor(p.Muted);
                        row.ConstantItem(60).AlignRight().Text(t =>
                        {
                            t.DefaultTextStyle(s => s.FontSize(8).FontColor(p.Muted));
                            t.CurrentPageNumber();
                            t.Span(" / ");
                            t.TotalPages();
                        });
                    });
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

    private static void ComposeLetterhead(ColumnDescriptor col, OfferLetterModel m, LetterPalette p)
    {
        var hasLogo = m.LogoBytes is { Length: > 0 };

        col.Item().Row(row =>
        {
            if (hasLogo)
            {
                row.ConstantItem(130).AlignMiddle().MaxHeight(52)
                    .Image(m.LogoBytes!).FitArea();
                row.ConstantItem(12);
            }

            // Có logo thì thông tin công ty dạt phải cho cân; không logo thì canh trái như thư thường.
            var info = row.RelativeItem().AlignMiddle();
            (hasLogo ? info.AlignRight() : info).Column(head =>
            {
                if (Has(m.CompanyName))
                    head.Item().Text(m.CompanyName!).FontSize(16).Bold().FontColor(p.Accent);
                if (Has(m.CompanyAddress))
                    head.Item().Text(m.CompanyAddress!).FontSize(9).FontColor(p.Muted);

                // "email | điện thoại" — chỉ nối gạch khi có cả hai, tránh dòng "| 0900..." cụt đầu.
                var contact = string.Join("  |  ",
                    new[] { m.CompanyEmail, m.CompanyPhone }.Where(Has)!);
                if (contact.Length > 0)
                    head.Item().Text(contact).FontSize(9).FontColor(p.Muted);
            });
        });

        // Kẻ đôi (đậm + nhạt) — thủ pháp letterhead cổ điển, rẻ mà lên hình rất "giấy tờ chính thức".
        col.Item().PaddingTop(3).Column(rule =>
        {
            rule.Item().LineHorizontal(2.2f).LineColor(p.Accent);
            rule.Item().PaddingTop(1.8f).LineHorizontal(0.6f).LineColor(p.SoftLine);
        });

        col.Item().AlignRight().Text($"Ngày {m.LetterDate:dd} tháng {m.LetterDate:MM} năm {m.LetterDate:yyyy}")
            .FontSize(9.5f).FontColor(p.Muted);
    }

    private static void ComposeTitle(ColumnDescriptor col, OfferLetterModel m, LetterPalette p)
    {
        col.Item().AlignCenter().Column(t =>
        {
            t.Item().AlignCenter().Text("THƯ MỜI NHẬN VIỆC")
                .FontSize(17).Bold().FontColor(p.Accent).LetterSpacing(0.06f);

            if (Has(m.JobTitle))
                t.Item().PaddingTop(2).AlignCenter().Text($"Vị trí: {m.JobTitle}")
                    .FontSize(11).SemiBold().FontColor(p.Muted);
        });
    }

    private static void ComposeRecipient(ColumnDescriptor col, OfferLetterModel m, LetterPalette p)
    {
        col.Item().Column(to =>
        {
            to.Item().Text(t =>
            {
                t.Span("Kính gửi: ");
                t.Span(Has(m.CandidateName) ? m.CandidateName! : "Quý ứng viên").Bold();
            });

            if (Has(m.CandidateAddress))
                to.Item().Text(m.CandidateAddress!).FontSize(9.5f).FontColor(p.Muted);
        });
    }

    private static void ComposeIntro(ColumnDescriptor col, OfferLetterModel m)
    {
        var title = Has(m.JobTitle) ? m.JobTitle! : "vị trí ứng tuyển";
        var company = Has(m.CompanyName) ? $" tại {m.CompanyName}" : "";

        col.Item().Text(
            $"Chúng tôi vui mừng thông báo và gửi lời mời bạn đảm nhận vị trí {title}{company}. " +
            "Sau khi xem xét trình độ, năng lực và kinh nghiệm của bạn, chúng tôi tin rằng bạn sẽ là " +
            "một thành viên có giá trị đối với đội ngũ của chúng tôi.")
            .Justify();
    }

    /// <summary>
    /// Khối "nhãn — giá trị" (Thông tin vị trí, Lương &amp; Phúc lợi). Nhãn xám cột trái, giá trị
    /// đậm cột phải: đọc lướt vẫn thấy ngay lương/ngày bắt đầu. Không có dòng nào -> bỏ cả khối.
    /// </summary>
    private static void ComposeFields(
        ColumnDescriptor col, string heading,
        IReadOnlyList<(string Label, string Value)> fields, LetterPalette p, bool highlight)
    {
        if (fields.Count == 0) return;

        col.Item().Column(section =>
        {
            section.Item().Element(e => ComposeHeading(e, heading, p));

            // Khối lương được tô nền nhạt + viền màu brand: đây là thứ ứng viên tìm đầu tiên.
            var body = section.Item().PaddingTop(4);
            body = highlight
                ? body.Background(p.Tint).BorderLeft(3).BorderColor(p.Accent)
                      .PaddingVertical(7).PaddingHorizontal(10)
                : body.PaddingLeft(6);

            body.Column(rows =>
            {
                rows.Spacing(3);
                foreach (var (label, value) in fields)
                {
                    rows.Item().Row(row =>
                    {
                        row.ConstantItem(128).Text(label).FontColor(p.Muted);
                        row.RelativeItem().Text(value).SemiBold();
                    });
                }
            });
        });
    }

    /// <summary>Khối gạch đầu dòng (điều khoản) — bullet là ô vuông nhỏ màu brand.</summary>
    private static void ComposeBullets(
        ColumnDescriptor col, string heading, IReadOnlyList<string> lines, LetterPalette p)
    {
        if (lines.Count == 0) return;

        col.Item().Column(section =>
        {
            section.Item().Element(e => ComposeHeading(e, heading, p));

            section.Item().PaddingTop(4).PaddingLeft(6).Column(body =>
            {
                body.Spacing(3);
                foreach (var line in lines)
                {
                    body.Item().Row(row =>
                    {
                        row.ConstantItem(13).PaddingTop(4.5f).Width(4).Height(4).Background(p.Accent);
                        row.RelativeItem().Text(line).Justify();
                    });
                }
            });
        });
    }

    /// <summary>Tiêu đề mục: thanh dọc màu brand + chữ hoa cùng màu.</summary>
    private static void ComposeHeading(IContainer container, string text, LetterPalette p)
    {
        container.Row(row =>
        {
            row.ConstantItem(3.5f).Background(p.Accent);
            row.RelativeItem().PaddingLeft(8).Text(text)
                .FontSize(10.5f).Bold().FontColor(p.Accent).LetterSpacing(0.04f);
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

    private static void ComposeSignature(ColumnDescriptor col, OfferLetterModel m, LetterPalette p)
    {
        // ShowEntire: nếu buộc phải sang trang thì đẩy CẢ khối ký, không tách
        // "Trân trọng," ở cuối trang 1 còn tên người ký nằm trơ trên trang 2.
        col.Item().PaddingTop(8).ShowEntire().Row(row =>
        {
            row.RelativeItem();                 // chừa trái, chữ ký dạt phải như thư hành chính
            row.ConstantItem(210).Column(sign =>
            {
                sign.Item().AlignCenter().Text("Trân trọng,").Italic();

                // Chừa khoảng trống để ký tay rồi mới kẻ dòng — bản in ra ký được luôn.
                sign.Item().PaddingTop(34).LineHorizontal(0.6f).LineColor(p.SoftLine);

                sign.Item().PaddingTop(4).Column(who =>
                {
                    if (Has(m.SignerName))
                        who.Item().AlignCenter().Text(m.SignerName!).Bold().FontColor(p.Accent);
                    if (Has(m.SignerTitle))
                        who.Item().AlignCenter().Text(m.SignerTitle!).FontSize(9.5f).FontColor(p.Muted);
                    if (Has(m.CompanyName))
                        who.Item().AlignCenter().Text(m.CompanyName!).FontSize(9.5f).FontColor(p.Muted);
                });
            });
        });
    }

    // ============================================================
    // Dựng nội dung từng dòng
    // ============================================================

    private static List<(string Label, string Value)> BuildPositionFields(OfferLetterModel m)
    {
        var fields = new List<(string, string)>();
        AddIf(fields, "Vị trí công việc", m.JobTitle);
        AddIf(fields, "Phòng ban", m.Department);
        AddIf(fields, "Báo cáo cho", m.ReportingTo);
        if (m.StartDate is DateTime start)
            fields.Add(("Ngày bắt đầu", start.ToString("dd/MM/yyyy")));
        AddIf(fields, "Hình thức làm việc", m.EmploymentType);
        AddIf(fields, "Địa điểm làm việc", m.WorkLocation);
        return fields;
    }

    private static List<(string Label, string Value)> BuildCompensationFields(OfferLetterModel m)
    {
        var fields = new List<(string, string)>
        {
            ("Mức lương", FormatSalary(m))
        };
        AddIf(fields, "Thưởng/Ưu đãi", m.Bonus);
        AddIf(fields, "Các phúc lợi khác", m.Benefits);
        return fields;
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
    private static string FormatSalary(OfferLetterModel m)
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

    private static void AddIf(ICollection<(string, string)> fields, string label, string? value)
    {
        if (Has(value)) fields.Add((label, value!.Trim()));
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
