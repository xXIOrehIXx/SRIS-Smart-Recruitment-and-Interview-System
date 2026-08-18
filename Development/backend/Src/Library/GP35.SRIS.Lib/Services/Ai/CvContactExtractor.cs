using System.Text.RegularExpressions;

namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>Thông tin liên hệ bóc được từ text CV — trường nào không chắc thì để null.</summary>
public record CvContact(string? FullName, string? Email, string? Phone);

/// <summary>
/// Bóc tên / email / điện thoại từ text CV để ĐIỀN SẴN form nhận hồ sơ (V047 — phản hồi hội
/// đồng 18/08/2026: "bóc tách CV để lấy ra thông tin").
///
/// <para>
/// Cố ý KHÔNG dùng LLM cho ba trường này. Email và số điện thoại có hình dạng cố định nên regex
/// đúng gần như tuyệt đối, chạy tức thì và không cần Ollama; còn LLM thì thỉnh thoảng chép sai
/// một chữ số — sai kiểu đó không ai phát hiện cho tới lúc gọi nhầm số. Phần cần ĐỌC HIỂU (tóm
/// tắt CV, đối chiếu với JD) vẫn là việc của model, ở <c>/screen-cv</c>.
/// </para>
///
/// <para>
/// Kết quả là GỢI Ý điền sẵn: người nhận hồ sơ vẫn nhìn và sửa trước khi lưu. Vì thế thà bỏ
/// trống còn hơn đoán bừa — đặc biệt là tên, thứ duy nhất ở đây không có hình dạng máy nhận ra được.
/// </para>
/// </summary>
public static class CvContactExtractor
{
    /// <summary>Chỉ đọc phần đầu CV: khối liên hệ luôn nằm trên cùng, xuống dưới là dễ vớ nhầm email công ty cũ.</summary>
    private const int HeadChars = 1200;

    private static readonly Regex EmailRx = new(
        @"[\p{L}0-9._%+\-]+@[\p{L}0-9.\-]+\.[A-Za-z]{2,}", RegexOptions.Compiled);

    /// <summary>
    /// Số Việt Nam: 0xxxxxxxxx / +84xxxxxxxxx / 84xxxxxxxxx, cho phép dấu cách, chấm, gạch,
    /// ngoặc xen giữa (CV hay trình bày "0912 345 678" hoặc "(+84) 912 345 678").
    /// <para>
    /// Tối đa HAI ký tự ngăn giữa hai chữ số, không phải "bao nhiêu cũng được": với dấu sao
    /// cũng khớp, chuỗi "0912 345 678 - 2019" nuốt luôn năm ở sau và trả ra một số 14 chữ số.
    /// Hai ký tự đủ cho ") " nhưng chặn " - ".
    /// </para>
    /// </summary>
    private static readonly Regex PhoneRx = new(
        @"(?:(?:\+?84)|0)(?:[\s.\-()]{0,2}\d){9,10}", RegexOptions.Compiled);

    /// <summary>Bóc (tên, email, điện thoại). Text rỗng -> cả ba null, caller cứ để form trống.</summary>
    public static CvContact Extract(string? cvText)
    {
        var text = (cvText ?? "").Trim();
        if (text.Length == 0) return new CvContact(null, null, null);

        var head = text.Length <= HeadChars ? text : text[..HeadChars];

        var email = EmailRx.Match(head) is { Success: true } m ? m.Value.Trim().Trim('.') : null;
        var phone = FindPhone(head);
        var name = FindName(head, email);

        return new CvContact(name, email, phone);
    }

    /// <summary>
    /// Số điện thoại đầu tiên có ĐÚNG 10-11 chữ số sau khi bỏ ký tự trang trí. Kiểm lại độ dài
    /// sau khi dọn vì regex đếm cả dấu cách: "0912 345 678 - 2019" mà nuốt luôn năm thì ra một
    /// chuỗi số vô nghĩa.
    /// </summary>
    private static string? FindPhone(string head)
    {
        foreach (Match m in PhoneRx.Matches(head))
        {
            var digits = new string(m.Value.Where(char.IsDigit).ToArray());
            if (digits.StartsWith("84")) digits = "0" + digits[2..];
            if (digits.Length is 10 or 11) return digits;
        }
        return null;
    }

    /// <summary>
    /// Tên ứng viên: dòng "trông giống tên người" đầu tiên ở đầu CV — 2-5 từ, toàn chữ cái, mỗi
    /// từ viết hoa chữ đầu (hoặc VIẾT HOA HẾT, kiểu trình bày rất phổ biến).
    ///
    /// <para>
    /// Đây là phần duy nhất phải ĐOÁN, nên luật đặt chặt và thà trả null: điền sai tên vào form
    /// rồi người dùng bấm lưu nhanh là hồ sơ mang tên người khác — tệ hơn hẳn ô trống. Bỏ qua
    /// dòng chứa email/số/ký tự lạ và các dòng tiêu đề kiểu "CURRICULUM VITAE".
    /// </para>
    /// </summary>
    private static string? FindName(string head, string? email)
    {
        var skipWords = new[]
        {
            "cv", "curriculum", "vitae", "resume", "hồ sơ", "ho so", "thông tin", "thong tin",
            "ứng viên", "ung vien", "profile", "portfolio"
        };

        var lines = head.Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => l.Trim())
            .Where(l => l.Length > 0)
            .Take(12);

        foreach (var line in lines)
        {
            if (line.Length is < 4 or > 60) continue;
            if (email is not null && line.Contains(email, StringComparison.OrdinalIgnoreCase)) continue;
            if (line.Any(char.IsDigit) || line.Contains('@')) continue;

            var lower = line.ToLowerInvariant();
            if (skipWords.Any(w => lower.Contains(w))) continue;

            var words = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (words.Length is < 2 or > 5) continue;
            if (!words.All(w => w.All(c => char.IsLetter(c) || c == '\'' || c == '-'))) continue;
            if (!words.All(w => char.IsUpper(w[0]))) continue;

            return line;
        }

        return null;
    }
}
