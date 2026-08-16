using System.Text;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.DocumentLayoutAnalysis.PageSegmenter;
using UglyToad.PdfPig.DocumentLayoutAnalysis.ReadingOrderDetector;
using UglyToad.PdfPig.DocumentLayoutAnalysis.WordExtractor;

namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>
/// Mắt xích đứng TRƯỚC luồng AI: "PDF -> text" bằng PdfPig (Apache-2.0/MIT, thuần .NET).
/// Phân loại:
///   - Loại 1: PDF có lớp text (xuất từ Word/Canva...) -> đọc thẳng.
///   - Loại 2: PDF layout 2 cột -> gom khối rồi sắp theo thứ tự đọc (xem bên dưới).
///   - Loại 3: PDF scan ảnh -> không có lớp text -> trả text rỗng -> NeedsManualEdit.
/// OCR cho loại 3 KHÔNG làm ở phase này.
///
/// <para>
/// VÌ SAO PHẢI PHÂN TÍCH BỐ CỤC chứ không đọc word rồi ghép: bản đầu tiên lấy
/// <c>page.GetWords()</c> rồi nối bằng dấu cách, và cố ý chấp nhận thứ tự lộn xộn — khi đó
/// người tiêu thụ text là embedding, vốn không nhạy thứ tự. Người tiêu thụ bây giờ là LLM
/// đọc hiểu, nên thứ tự là TẤT CẢ: CV hai cột ra text cài răng lược giữa hai cột, LLM đọc
/// tiêu đề mục thành tên công ty, đọc năm ở cột trái ghép vào chức danh ở cột phải. Đó
/// đúng là lý do tính năng tóm tắt CV thêm ở V033 bị bỏ ngay ở V034 — không sửa mắt xích
/// này thì mọi tính năng đọc CV bằng AI đều hỏng theo cùng một kiểu.
/// </para>
/// </summary>
public class PdfTextExtractor : IPdfTextExtractor
{
    /// <summary>
    /// Ngưỡng ký tự phân biệt loại 3 (PDF scan ảnh) với loại 1/2.
    /// Một CV thật luôn dài hơn rất nhiều; PDF scan gần như không vượt nổi ngưỡng này.
    /// </summary>
    public const int CharThreshold = 50;

    /// <summary>
    /// Gom word thành khối văn bản (Docstrum) — thuật toán ước lượng khoảng cách dòng/chữ
    /// của chính trang đó rồi cụm lại, nên không cần biết trước CV mấy cột.
    /// Tạo mới mỗi lần dùng: lớp này không hứa an toàn đa luồng, mà extractor là singleton.
    /// </summary>
    private static IPageSegmenter NewSegmenter() => new DocstrumBoundingBoxes();

    public PdfExtractResult Extract(byte[] pdfBytes)
    {
        var sb = new StringBuilder();
        int pageCount;

        using (PdfDocument doc = PdfDocument.Open(pdfBytes))
        {
            pageCount = doc.NumberOfPages;

            foreach (Page page in doc.GetPages())
                sb.Append(ExtractPage(page)).Append('\n');
        }

        string text = Normalize(sb.ToString());

        PdfKind kind = text.Length < CharThreshold
            ? PdfKind.NeedsManualEdit
            : PdfKind.HasText;

        return new PdfExtractResult(kind, text, pageCount, text.Length);
    }

    /// <summary>
    /// Một trang -> text theo thứ tự đọc của con người.
    /// <para>
    /// Ba bước: (1) ghép ký tự thành word bằng <see cref="NearestNeighbourWordExtractor"/>
    /// — KHÔNG dùng <c>page.Text</c> vì nó nối các mẩu chữ dính liền ("KHÁNHJunior");
    /// (2) cụm word thành khối bằng Docstrum; (3) sắp các khối theo thứ tự đọc.
    /// </para>
    /// </summary>
    private static string ExtractPage(Page page)
    {
        var words = page.GetWords(NearestNeighbourWordExtractor.Instance).ToList();
        if (words.Count == 0) return string.Empty;

        try
        {
            var blocks = NewSegmenter().GetBlocks(words);
            var ordered = UnsupervisedReadingOrderDetector.Instance.Get(blocks);

            var sb = new StringBuilder();
            foreach (var block in ordered)
            {
                // Mỗi khối = một mục của CV (một chỗ làm, một mục học vấn...). Ngăn bằng
                // dòng trắng để LLM thấy được ranh giới giữa các mục thay vì một khối chữ
                // chạy liền — ranh giới đó là thứ giữ cho "2019-2022" không bị gán nhầm
                // sang chỗ làm ở khối kế tiếp.
                foreach (var line in block.TextLines)
                    sb.AppendLine(line.Text);
                sb.AppendLine();
            }
            return sb.ToString();
        }
        catch (Exception)
        {
            // Phân tích bố cục là heuristic hình học: trang dựng lạ (bảng lồng nhau, toạ độ
            // suy biến) làm nó ném lỗi. Mất thứ tự đọc còn hơn mất trắng cả trang, nên rơi
            // về cách cũ: nối word theo thứ tự trong file.
            return string.Join(' ', words.Select(w => w.Text));
        }
    }

    /// <summary>
    /// Dọn khoảng trắng nhưng GIỮ xuống dòng: xuống dòng là thứ mang nghĩa cho LLM đọc CV.
    /// (Bản cũ gom mọi khoảng trắng về một dấu cách vì embedding không cần đến chúng.)
    /// </summary>
    private static string Normalize(string raw)
    {
        // Dấu cách/tab lặp -> 1 dấu cách. Không đụng vào \n (dùng lớp ký tự tường minh
        // thay vì \s để \n không bị nuốt).
        var text = Regex.Replace(raw, @"[^\S\n]+", " ");
        // Bỏ dấu cách thừa ở đầu/cuối dòng.
        text = Regex.Replace(text, @" *\n *", "\n");
        // Tối đa 1 dòng trắng ngăn cách — nhiều hơn chỉ tốn token.
        text = Regex.Replace(text, @"\n{3,}", "\n\n");
        return text.Trim();
    }
}
