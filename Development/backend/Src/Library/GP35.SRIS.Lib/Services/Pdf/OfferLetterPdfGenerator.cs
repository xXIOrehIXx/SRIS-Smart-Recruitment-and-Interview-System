using System.Globalization;
using System.Text;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace GP35.SRIS.Lib.Services.Pdf;

/// <summary>
/// Sinh PDF thư mời nhận việc bằng QuestPDF (docs 5.15).
///
/// Bố cục bám theo thư mẫu (<c>docs/offer letter.png</c>): khung viền mảnh màu brand chạy
/// quanh trang, nền giấy tím-xám rất nhạt, logo + tiêu đề canh giữa, phần thân canh trái
/// với các mục gạch đầu dòng ❖.
///
/// Màu khung lấy từ <c>Company.primary_color</c> qua <see cref="LetterPalette"/> nên mỗi tenant
/// ra một lá thư mang màu của chính họ; chưa cấu hình brand thì dùng cyan như thư mẫu.
///
/// Font: Lato (QuestPDF nhúng sẵn trong package) — đã kiểm tra hiển thị đủ dấu tiếng Việt,
/// nên KHÔNG phụ thuộc font cài trên máy chủ (chạy được cả trên Linux container).
/// </summary>
public class OfferLetterPdfGenerator : IOfferLetterPdfGenerator
{
    private const string FontFamily = "Lato";

    /// <summary>Ký tự gạch đầu dòng của thư mẫu.</summary>
    private const string Bullet = "❖";

    /// <summary>Khoảng trắng từ mép giấy tới khung viền.</summary>
    private const float OuterMargin = 9f;

    /// <summary>Khoảng cách giữa các khối lớn (thư mẫu để trống chừng một dòng).</summary>
    private const float BlockGap = 11f;

    /// <summary>Giãn dòng của khối địa chỉ — thư mẫu xếp sít, không giãn như đoạn văn.</summary>
    private const float TightLine = 1.08f;

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
    /// (<c>GenerateImages</c>) khi cần đối chiếu bố cục với thư mẫu — kiểm bằng mắt thay vì đoán.
    /// </summary>
    public Document BuildDocument(OfferLetterModel m)
    {
        var p = LetterPalette.From(m.BrandColor);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(0);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(t => t.FontFamily(FontFamily).FontSize(10)
                    .LineHeight(1.22f).FontColor(p.Body));

                // Khung viền + nền giấy vẽ ở lớp Background nên phủ TRỌN trang, không co theo
                // chiều cao nội dung — thư ngắn vẫn có khung chạy hết trang như thư mẫu.
                page.Background()
                    .Padding(OuterMargin)
                    .Border(1.4f).BorderColor(p.Frame)
                    .Background(p.Paper);

                // Nội dung nằm trong khung: cộng thêm lề trong cho chữ không dính viền.
                page.Content()
                    .PaddingHorizontal(OuterMargin + 26)
                    .PaddingTop(OuterMargin + 22)
                    .PaddingBottom(OuterMargin + 20)
                    .Column(col =>
                    {
                        ComposeHeader(col, m, p);
                        ComposeSenderBlock(col, m);
                        ComposeDateAndRecipient(col, m);
                        ComposeSubjectAndIntro(col, m);

                        ComposeSection(col, "Thông tin vị trí:", BuildPositionLines(m), p);
                        ComposeSection(col, "Lương & Phúc lợi:", BuildCompensationLines(m), p);
                        ComposeSection(col, "Điều khoản & Điều kiện:", BuildTermsLines(m), p);

                        ComposeClosing(col, m);
                        ComposeSignature(col, m);
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

    /// <summary>Logo canh giữa + tiêu đề lớn canh giữa — đúng thứ tự của thư mẫu.</summary>
    private static void ComposeHeader(ColumnDescriptor col, OfferLetterModel m, LetterPalette p)
    {
        if (m.LogoBytes is { Length: > 0 })
        {
            col.Item().AlignCenter().MaxHeight(46).MaxWidth(220)
                .Image(m.LogoBytes).FitArea();
            col.Item().Height(16);
        }

        col.Item().AlignCenter().Text("THƯ MỜI NHẬN VIỆC")
            .FontSize(20).Bold().FontColor(p.Heading);

        col.Item().Height(18);
    }

    private static void ComposeSenderBlock(ColumnDescriptor col, OfferLetterModel m)
    {
        col.Item().Column(head =>
        {
            if (Has(m.CompanyName))
                head.Item().Text(m.CompanyName!).Bold().LineHeight(TightLine);
            if (Has(m.CompanyAddress))
                head.Item().Text(m.CompanyAddress!).LineHeight(TightLine);

            // "email | điện thoại" — chỉ nối gạch khi có cả hai, tránh dòng "| 0900..." cụt đầu.
            var contact = string.Join(" | ", new[] { m.CompanyEmail, m.CompanyPhone }.Where(Has)!);
            if (contact.Length > 0)
                head.Item().Text(contact).LineHeight(TightLine);
        });
    }

    private static void ComposeDateAndRecipient(ColumnDescriptor col, OfferLetterModel m)
    {
        col.Item().Height(BlockGap);
        col.Item().Text($"Ngày {m.LetterDate:dd} tháng {m.LetterDate:MM} năm {m.LetterDate:yyyy}");

        col.Item().Height(BlockGap);
        col.Item().Column(to =>
        {
            to.Item().Text(Has(m.CandidateName) ? m.CandidateName! : "Quý ứng viên")
                .Bold().LineHeight(TightLine);
            if (Has(m.CandidateAddress))
                to.Item().Text(m.CandidateAddress!).LineHeight(TightLine);
        });
    }

    private static void ComposeSubjectAndIntro(ColumnDescriptor col, OfferLetterModel m)
    {
        // Thiếu tên vị trí thì BỎ HẲN cụm "cho vị trí ..." — nhét chữ thay thế vào sau chữ
        // "vị trí" đẻ ra câu "cho vị trí vị trí ứng tuyển" ngay trên văn bản gửi ứng viên.
        var hasTitle = Has(m.JobTitle);

        col.Item().Height(BlockGap);
        col.Item().Text(hasTitle
            ? $"Chủ đề: Thư mời nhận việc cho vị trí {m.JobTitle}"
            : "Chủ đề: Thư mời nhận việc");

        var position = hasTitle ? $"vị trí {m.JobTitle}" : "vị trí bạn đã ứng tuyển";
        var company = Has(m.CompanyName) ? $" tại {m.CompanyName}" : "";

        col.Item().Height(BlockGap);
        col.Item().Text(
            $"Kính gửi {(Has(m.CandidateName) ? m.CandidateName : "Quý ứng viên")}, " +
            $"chúng tôi vui mừng thông báo và gửi lời mời bạn đảm nhận {position}{company}. " +
            "Sau khi xem xét trình độ, năng lực và kinh nghiệm của bạn, chúng tôi tin rằng bạn sẽ là " +
            "một thành viên có giá trị đối với đội ngũ của chúng tôi.")
            ;
    }

    /// <summary>
    /// 1 khối "tiêu đề đậm + các dòng ❖" như thư mẫu. Không có dòng nào -> bỏ luôn cả khối
    /// (thư không bao giờ in tiêu đề rỗng).
    /// </summary>
    private static void ComposeSection(
        ColumnDescriptor col, string heading, IReadOnlyList<string> lines, LetterPalette p)
    {
        if (lines.Count == 0) return;

        col.Item().Height(BlockGap);
        col.Item().Text(heading).Bold().FontColor(p.Heading);
        col.Item().Height(7);

        col.Item().PaddingLeft(20).Column(body =>
        {
            body.Spacing(3);
            foreach (var line in lines)
            {
                body.Item().Row(row =>
                {
                    row.ConstantItem(16).Text(Bullet).FontSize(9);
                    row.RelativeItem().Text(line);
                });
            }
        });
    }

    private static void ComposeClosing(ColumnDescriptor col, OfferLetterModel m)
    {
        if (Has(m.Note))
        {
            col.Item().Height(BlockGap);
            col.Item().Text(m.Note!);
        }

        var deadline = m.AcceptanceDeadline is DateTime d
            ? $" trước ngày {d:dd/MM/yyyy}"
            : "";

        col.Item().Height(BlockGap);
        col.Item().Text(
            $"Vui lòng phản hồi xác nhận việc bạn đồng ý với lời mời nhận việc này{deadline}. " +
            $"Nếu có bất kỳ câu hỏi nào, vui lòng liên hệ {BuildHrContactPhrase(m)}.")
            ;

        col.Item().Height(BlockGap);
        col.Item().Text("Chúng tôi rất vui mừng chào đón bạn gia nhập đội ngũ và mong được hợp tác cùng bạn!")
            ;
    }

    /// <summary>
    /// Chân thư: lời chào + người ký. KHÔNG có ô ký tay — thư mời ở đây là thông báo gửi
    /// qua email, ứng viên trả lời bằng email chứ không in ra ký rồi gửi lại (5.15).
    /// </summary>
    private static void ComposeSignature(ColumnDescriptor col, OfferLetterModel m)
    {
        col.Item().Height(BlockGap);

        // ShowEntire: nếu buộc phải sang trang thì đẩy CẢ khối ký, không tách
        // "Trân trọng," ở cuối trang 1 còn tên người ký nằm trơ trên trang 2.
        col.Item().ShowEntire().Column(sign =>
        {
            sign.Item().Text("Trân trọng,");
            sign.Item().Height(BlockGap);

            if (Has(m.SignerName)) sign.Item().Text(m.SignerName!).Bold().LineHeight(TightLine);
            if (Has(m.SignerTitle)) sign.Item().Text(m.SignerTitle!).LineHeight(TightLine);
            if (Has(m.CompanyName)) sign.Item().Text(m.CompanyName!).LineHeight(TightLine);
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
        var lines = new List<string> { $"Mức lương: {FormatSalary(m)}" };
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
