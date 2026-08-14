using System.Text;
using System.Text.RegularExpressions;

namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>
/// Dọn danh sách tiêu chí AI bóc được TRƯỚC khi ghi DB — bằng luật, không bằng prompt.
///
/// <para>
/// Vì sao lọc ở đây chứ không viết thêm luật vào prompt: prompt là XIN model làm, code là ÉP.
/// Số đo trong <c>ai-experiments/exp_criteria_extract/out/KET_QUA.md</c> cho thấy prompt
/// production (V4) ĐÃ có sẵn luật "bỏ thứ đọc hồ sơ là biết" kèm ví dụ mẫu, mà vẫn để lọt
/// 7,7% dòng giấy tờ; và luật "mỗi tiêu chí một kỹ năng" thêm ở V3 còn không nhúc nhích được
/// tỉ lệ gộp (34,2% -> 35,0%). Thêm luật thứ N vào một prompt đã dài là đánh cược, lại tốn
/// token và tốn giây chờ LLM trên CPU. Regex thì tất định và test được trong mili giây.
/// </para>
///
/// <para>
/// Hai lớp lọc, HAI cách xử lý khác nhau — đây là điểm dễ nhầm:
/// <list type="bullet">
///   <item>GIẤY TỜ (bằng cấp, chứng chỉ, bằng lái, nơi ở, tuổi, ngoại hình) -> BỎ HẲN dòng đó.
///     Không có gì cứu được: "có bằng B2" là có/không, cho điểm 0-10 chỉ làm loãng phiếu chấm.</item>
///   <item>NGƯỠNG ĐỐI CHIẾU ("tối thiểu 2 năm", "từ 3 năm trở lên") -> CẮT phần ngưỡng, GIỮ phần
///     còn lại. Con số năm thì cầm CV lên đối chiếu là xong, nhưng thứ nằm sau nó — "kinh nghiệm
///     mảng C&amp;B" — vẫn đáng hỏi trong buổi phỏng vấn. Bỏ cả dòng là mất oan một tiêu chí thật.</item>
/// </list>
/// </para>
///
/// <para>
/// Bộ mẫu giấy tờ giữ NGUYÊN VĂN <c>GIAY_TO_PATTERNS</c> trong <c>metrics.py</c> của bộ đo.
/// Cố ý không "cải tiến" thêm: lệch đi thì con số 7,7% trong báo cáo không còn mô tả đúng
/// thứ đang chạy thật nữa. Đổi mẫu ở đây thì phải đổi cả bên kia rồi đo lại.
/// </para>
///
/// <para>
/// Lọc nhầm không gây hại chết người: tiêu chí ghi xuống vẫn là DRAFT chờ người duyệt, họ thêm
/// lại được. Nhưng dòng bị bỏ thì người dùng KHÔNG thấy, nên caller phải ghi log — không có log
/// thì sau này không phân biệt nổi "model đã khá lên" với "regex giấu bớt".
/// </para>
/// </summary>
public static class CriteriaNameFilter
{
    /// <summary>Kết quả lọc — kèm phần bị bỏ/bị sửa để caller ghi log.</summary>
    /// <param name="Criteria">Danh sách đã dọn, giữ nguyên thứ tự ưu tiên model trả về.</param>
    /// <param name="Dropped">Tên các dòng bị bỏ hẳn (giấy tờ, hoặc cắt ngưỡng xong còn trơ khung).</param>
    /// <param name="Rewritten">Các dòng bị cắt ngưỡng, dạng "trước -> sau".</param>
    public record FilterResult(
        IReadOnlyList<ExtractedCriterion> Criteria,
        IReadOnlyList<string> Dropped,
        IReadOnlyList<string> Rewritten);

    // ---------------------------------------------------------------------
    //  Lớp 1 — GIẤY TỜ: dò trên chuỗi đã bỏ dấu + hạ thường (khớp _khong_dau bên metrics.py)
    // ---------------------------------------------------------------------
    // Gồm cả nhân khẩu học (tuổi, giới tính, nơi ở, ngoại hình) vì cùng bản chất: nhìn hồ sơ
    // là biết, có/không, không ai cho điểm 0-10 được.
    //
    // Nhược điểm đã biết: "ky su" bắt cả "Kinh nghiệm làm kỹ sư cầu nối" — một tiêu chí thật.
    // Giữ nguyên mẫu để khớp bộ đo; bù lại bằng log ở caller và bằng việc người duyệt thêm lại
    // được. Gặp nhiều ca như vậy trong thực tế thì siết mẫu Ở CẢ HAI NƠI rồi đo lại, đừng sửa lén.
    private static readonly Regex[] GiayToPatterns =
    [
        Bo(@"\bbang cap\b"),   Bo(@"\bbang dai hoc\b"), Bo(@"\bbang cu nhan\b"), Bo(@"\btot nghiep\b"),
        Bo(@"\bcu nhan\b"),    Bo(@"\bthac si\b"),      Bo(@"\bky su\b"),        Bo(@"\bcao dang\b"),
        Bo(@"\bdai hoc\b"),    Bo(@"\btrung cap\b"),    Bo(@"\bthpt\b"),         Bo(@"\bchung chi\b"),
        Bo(@"\bchung nhan\b"), Bo(@"\bbang lai\b"),     Bo(@"\bgplx\b"),         Bo(@"\bgiay phep\b"),
        Bo(@"\bdo tuoi\b"),    Bo(@"\btuoi tu\b"),      Bo(@"\bgioi tinh\b"),    Bo(@"\bnam, nu\b"),
        Bo(@"\bho khau\b"),    Bo(@"\bthuong tru\b"),   Bo(@"\btam tru\b"),
        Bo(@"\bchieu cao\b"),  Bo(@"\bngoai hinh\b"),
    ];

    // ---------------------------------------------------------------------
    //  Lớp 2 — NGƯỠNG: cắt trên chuỗi GỐC (còn dấu) vì phần giữ lại phải hiện ra màn hình
    // ---------------------------------------------------------------------
    // "tối thiểu 2 năm", "từ 3-5 năm", "trên 2 năm", "1.5 năm"... KHÔNG nuốt chữ "kinh nghiệm"
    // đứng sau: đó chính là phần cần giữ ("Tối thiểu 2 năm kinh nghiệm C&B" -> "Kinh nghiệm C&B").
    private static readonly Regex SoNam = Bo(
        @"(?:tối\s*thiểu|ít\s*nhất|tối\s*đa|khoảng|trên|hơn|từ)?\s*" +
        @"\d+(?:[.,]\d+)?\s*(?:[-–—+]\s*\d+(?:[.,]\d+)?\s*)?năm");

    private static readonly Regex TroLen = Bo(@"\s*trở\s*(?:lên|xuống)\b");

    // Qualifier còn trơ lại khi câu không có chữ "năm": "Tối thiểu trình độ B1 tiếng Anh".
    private static readonly Regex QualifierTro = Bo(@"\b(?:tối\s*thiểu|ít\s*nhất)\b\s*");

    // Rác đầu câu sau khi cắt: "Có  kinh nghiệm..." -> "kinh nghiệm...".
    private static readonly Regex RacDauCau = Bo(@"^(?:có|và|hoặc|với|,|;|-|–|—|:)\s*");
    private static readonly Regex RacCuoiCau = Bo(@"[,;:\-–—]+$");
    private static readonly Regex ThuaKhoangTrang = Bo(@"\s{2,}");

    // Khung rỗng: cắt ngưỡng xong chỉ còn chữ chung chung thì dòng đó vô nghĩa trên phiếu chấm.
    // "Tối thiểu 2 năm kinh nghiệm" -> "Kinh nghiệm" -> không chấm được cái gì -> bỏ.
    private static readonly Regex TuChungChung = Bo(
        @"\b(?:kinh nghiem|lam viec|linh vuc|chuyen mon|co|trong|tai|voi|ve|va|nam)\b");

    private static Regex Bo(string pattern) =>
        new(pattern, RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// Dọn cả danh sách: bỏ giấy tờ, cắt ngưỡng, khử trùng lặp. Giữ nguyên thứ tự model trả về
    /// (model xếp tiêu chí lõi lên trước — xem luật "giữ 10 cái quan trọng nhất" trong prompt).
    /// </summary>
    public static FilterResult Apply(IEnumerable<ExtractedCriterion> criteria)
    {
        var ketQua = new List<ExtractedCriterion>();
        var boDi = new List<string>();
        var viet = new List<string>();
        var daThay = new HashSet<string>(StringComparer.Ordinal);

        foreach (var c in criteria)
        {
            var goc = (c.Name ?? "").Trim();
            if (goc.Length == 0) continue;

            if (LaGiayTo(goc))
            {
                boDi.Add(goc);
                continue;
            }

            var ten = CatNguong(goc);
            if (ten is null)
            {
                boDi.Add(goc);
                continue;
            }
            if (!string.Equals(ten, goc, StringComparison.Ordinal))
                viet.Add($"{goc} -> {ten}");

            // Cắt ngưỡng có thể làm hai dòng khác nhau chụm về một tên. Giữ dòng ĐẦU: nó đứng
            // trước trong thứ tự ưu tiên của model.
            if (!daThay.Add(KhongDau(ten)))
            {
                boDi.Add(goc);
                continue;
            }

            ketQua.Add(c with { Name = ten });
        }

        return new FilterResult(ketQua, boDi, viet);
    }

    /// <summary>Dòng này có phải thứ cầm hồ sơ lên là kết luận được ngay không?</summary>
    public static bool LaGiayTo(string name)
    {
        var plain = KhongDau(name);
        return GiayToPatterns.Any(p => p.IsMatch(plain));
    }

    /// <summary>
    /// Cắt phần ngưỡng đối chiếu, trả về tên đã dọn — hoặc <c>null</c> nếu cắt xong chỉ còn
    /// khung rỗng ("Tối thiểu 2 năm kinh nghiệm" không còn gì để chấm).
    /// Không có ngưỡng thì trả lại nguyên văn.
    /// </summary>
    public static string? CatNguong(string name)
    {
        var s = SoNam.Replace(name, " ");
        s = TroLen.Replace(s, " ");
        s = QualifierTro.Replace(s, " ");

        s = ThuaKhoangTrang.Replace(s, " ").Trim();

        // "Có và kinh nghiệm..." cần gỡ nhiều lớp, nên lặp tới khi hết.
        string truoc;
        do
        {
            truoc = s;
            s = RacDauCau.Replace(s, "").Trim();
        } while (truoc != s);

        s = RacCuoiCau.Replace(s, "").Trim();

        if (s.Length < 2) return null;

        // Bỏ hết từ chung chung mà không còn chữ/số nào thì dòng này không chấm được.
        var loi = TuChungChung.Replace(KhongDau(s), " ");
        if (loi.Count(char.IsLetterOrDigit) < 2) return null;

        return HoaChuDau(s);
    }

    /// <summary>Bỏ dấu tiếng Việt + hạ chữ thường — khớp <c>_khong_dau()</c> bên metrics.py.</summary>
    private static string KhongDau(string s)
    {
        var tach = s.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(tach.Length);
        foreach (var ch in tach)
        {
            if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch)
                != System.Globalization.UnicodeCategory.NonSpacingMark)
                sb.Append(ch == 'đ' ? 'd' : ch);
        }
        return sb.ToString();
    }

    private static string HoaChuDau(string s) =>
        char.IsLower(s[0]) ? char.ToUpperInvariant(s[0]) + s[1..] : s;
}
