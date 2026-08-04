using System.Text.RegularExpressions;

namespace GP35.SRIS.Application.Services.Ai;

/// <summary>
/// Đối chiếu tiêu chí dạng "≥ N năm kinh nghiệm" bằng SỐ thay vì tìm chuỗi (docs 5.18).
///
/// Vì sao cần: lọc keyword không giải quyết được nhóm tiêu chí này — CV hiếm khi viết thẳng
/// "3 năm kinh nghiệm", nó viết mốc thời gian ("03/2021 – hiện tại"). Tìm chuỗi "3 năm" vừa
/// bỏ sót người đủ điều kiện, vừa khớp nhầm câu như "3 năm đại học".
///
/// Cách làm: (1) đọc yêu cầu N từ tên/keywords của tiêu chí; (2) quét MỌI mốc thời gian trong
/// CV, gộp các khoảng CHỒNG LẤN (làm 2 việc cùng lúc không tính hai lần) rồi cộng lại;
/// (3) so hai con số. Bằng chứng trả về là danh sách mốc đã tìm thấy — người sàng lọc nhìn phát
/// biết máy tính đúng hay sai, đúng tinh thần "AI chỉ ra bằng chứng, con người phán".
/// </summary>
public static class ExperienceYearsMatcher
{
    /// <summary>Không nhận mốc trước năm này (tránh bắt nhầm năm sinh).</summary>
    private const int MinYear = 1980;

    /// <summary>Khoảng dài hơn ngần này gần như chắc chắn là bắt nhầm (vd năm sinh – hiện tại).</summary>
    private const int MaxRangeMonths = 40 * 12;

    /// <summary>Số mốc tối đa đưa vào bằng chứng — đủ để người đọc kiểm chứng, không làm ngập UI.</summary>
    private const int MaxEvidenceRanges = 6;

    /// <summary>Kết quả quét CV: số năm ước tính (null = không tìm thấy mốc nào) + các mốc đã thấy.</summary>
    public sealed record ExperienceScan(double? Years, IReadOnlyList<string> Ranges);

    // "kinh nghiem" / "experience" / "exp" — dùng để chắc chắn con số nói về kinh nghiệm.
    private static readonly Regex ExperienceContext = new(
        @"kinh nghiem|experience|\bexp\b|\byoe\b", RegexOptions.Compiled);

    // "2-3 nam" / "2 den 3 nam" -> lấy số ĐẦU (yêu cầu tối thiểu).
    private static readonly Regex YearRangeRequirement = new(
        @"(\d+(?:[.,]\d+)?)\s*(?:[-–—]|den|to)\s*\d+(?:[.,]\d+)?\s*\+?\s*(?:nam|year|yr)",
        RegexOptions.Compiled);

    // "3 nam" / "3+ years" / "3 yrs"
    private static readonly Regex SingleYearRequirement = new(
        @"(\d+(?:[.,]\d+)?)\s*\+?\s*(?:nam|year|yr)", RegexOptions.Compiled);

    // Mốc thời gian: "03/2021 - hien tai", "2019 - 2022", "01.2020 den 12.2023".
    // Nhánh tháng/năm đứng TRƯỚC nhánh năm trần để "03/2021" không bị đọc thành năm 2021 trơ trọi.
    private static readonly Regex DateRange = new(
        @"(?<s>\d{1,2}\s*[\/.\-]\s*\d{4}|\d{4})\s*(?:[-–—]|den\b|to\b)\s*" +
        @"(?<e>\d{1,2}\s*[\/.\-]\s*\d{4}|\d{4}|hien tai|hien nay|den nay|nay\b|present|now|current)",
        RegexOptions.Compiled);

    /// <summary>
    /// Đọc yêu cầu số năm từ text tiêu chí. Trả null nếu tiêu chí KHÔNG phải dạng đếm năm
    /// (khi đó bên gọi giữ nguyên cách lọc keyword cũ).
    /// </summary>
    /// <remarks>
    /// Bắt buộc có ngữ cảnh "kinh nghiệm" để "2 năm" trong "bằng cấp 2 năm" hay chữ "nam"
    /// (giới tính, bỏ dấu thành "nam") không bị hiểu nhầm thành yêu cầu kinh nghiệm.
    /// </remarks>
    public static double? ParseRequiredYears(string? criterionText)
    {
        if (string.IsNullOrWhiteSpace(criterionText)) return null;

        var text = CriteriaScoringService.RemoveDiacritics(criterionText.ToLowerInvariant());
        if (!ExperienceContext.IsMatch(text)) return null;

        var range = YearRangeRequirement.Match(text);
        if (range.Success && TryParseNumber(range.Groups[1].Value, out var low)) return low;

        var single = SingleYearRequirement.Match(text);
        if (single.Success && TryParseNumber(single.Groups[1].Value, out var years)) return years;

        return null;
    }

    /// <summary>
    /// Quét CV lấy tổng số năm kinh nghiệm từ các mốc thời gian (đã gộp khoảng chồng lấn).
    /// </summary>
    public static ExperienceScan ScanCv(string? cvText, DateTime? today = null)
    {
        if (string.IsNullOrWhiteSpace(cvText)) return new ExperienceScan(null, Array.Empty<string>());

        var now = today ?? DateTime.UtcNow;
        var ascii = CriteriaScoringService.RemoveDiacritics(cvText.ToLowerInvariant());

        var intervals = new List<(int Start, int End)>();
        var ranges = new List<string>();

        foreach (Match m in DateRange.Matches(ascii))
        {
            var start = ParseStartToken(m.Groups["s"].Value, now);
            var end = ParseEndToken(m.Groups["e"].Value, now);
            if (start is null || end is null) continue;

            var (s, e) = (start.Value, end.Value);
            if (e < s || e - s > MaxRangeMonths) continue;

            intervals.Add((s, e));

            // Cắt trên text GỐC để bằng chứng giữ nguyên dấu ("hiện tại" chứ không phải "hien tai").
            if (ranges.Count < MaxEvidenceRanges && m.Index + m.Length <= cvText.Length)
                ranges.Add(cvText.Substring(m.Index, m.Length).Trim());
        }

        if (intervals.Count == 0) return new ExperienceScan(null, Array.Empty<string>());

        var months = MergeAndSumMonths(intervals);
        return new ExperienceScan(Math.Round(months / 12.0, 1), ranges);
    }

    /// <summary>Gộp các khoảng chồng lấn rồi cộng tổng số tháng.</summary>
    private static int MergeAndSumMonths(List<(int Start, int End)> intervals)
    {
        intervals.Sort((a, b) => a.Start.CompareTo(b.Start));

        var total = 0;
        var (curStart, curEnd) = intervals[0];
        foreach (var (s, e) in intervals.Skip(1))
        {
            if (s <= curEnd)
            {
                curEnd = Math.Max(curEnd, e);   // chồng lấn -> nối dài, không cộng hai lần
                continue;
            }
            total += curEnd - curStart;
            (curStart, curEnd) = (s, e);
        }
        return total + (curEnd - curStart);
    }

    /// <summary>Mốc bắt đầu: "03/2021" -> tháng 3; năm trần "2019" -> tính từ đầu năm.</summary>
    private static int? ParseStartToken(string token, DateTime now) => ParseDateToken(token, now, monthWhenYearOnly: 1);

    /// <summary>
    /// Mốc kết thúc: năm trần "2021" -> tính HẾT năm (tức mốc 01/2022, nên "2019 - 2021" = 3 năm
    /// chứ không phải 2 năm 11 tháng); "hiện tại" -> hôm nay.
    /// </summary>
    private static int? ParseEndToken(string token, DateTime now)
    {
        var t = token.Trim();
        if (t is "hien tai" or "hien nay" or "den nay" or "nay" or "present" or "now" or "current")
            return AbsoluteMonths(now.Year, now.Month);

        return ParseDateToken(t, now, monthWhenYearOnly: 13);
    }

    private static int? ParseDateToken(string token, DateTime now, int monthWhenYearOnly)
    {
        var parts = token.Split(['/', '.', '-'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        int year, month;
        if (parts.Length == 2)
        {
            if (!int.TryParse(parts[0], out month) || !int.TryParse(parts[1], out year)) return null;
            if (month is < 1 or > 12) return null;
        }
        else if (parts.Length == 1)
        {
            if (!int.TryParse(parts[0], out year)) return null;
            month = monthWhenYearOnly;
        }
        else return null;

        // Chặn năm sinh và năm tương lai vô lý.
        if (year < MinYear || year > now.Year + 1) return null;

        return AbsoluteMonths(year, month);
    }

    private static int AbsoluteMonths(int year, int month) => year * 12 + (month - 1);

    private static bool TryParseNumber(string raw, out double value) =>
        double.TryParse(raw.Replace(',', '.'), System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out value);
}
