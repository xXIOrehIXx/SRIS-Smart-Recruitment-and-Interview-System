using System.Text;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>
/// Mắt xích đứng TRƯỚC luồng AI: "PDF -> text" bằng PdfPig (Apache-2.0/MIT, thuần .NET).
/// Phân loại:
///   - Loại 1: PDF có lớp text (xuất từ Word/Canva...) -> đọc thẳng.
///   - Loại 2: PDF layout 2 cột phức tạp -> thứ tự chữ có thể lộn xộn nhưng
///             embedding không nhạy thứ tự -> vẫn chấm điểm đúng.
///   - Loại 3: PDF scan ảnh -> không có lớp text -> trả text rỗng -> NeedsManualEdit.
/// OCR cho loại 3 KHÔNG làm ở phase này.
/// </summary>
public class PdfTextExtractor : IPdfTextExtractor
{
    /// <summary>
    /// Ngưỡng ký tự phân biệt loại 3 (PDF scan ảnh) với loại 1/2.
    /// Một CV thật luôn dài hơn rất nhiều; PDF scan gần như không vượt nổi ngưỡng này.
    /// </summary>
    public const int CharThreshold = 50;

    public PdfExtractResult Extract(byte[] pdfBytes)
    {
        var sb = new StringBuilder();
        int pageCount;

        using (PdfDocument doc = PdfDocument.Open(pdfBytes))
        {
            pageCount = doc.NumberOfPages;

            foreach (Page page in doc.GetPages())
            {
                // Lấy text theo TỪNG WORD rồi ghép bằng dấu cách (không dùng page.Text
                // vì nó ghép các mẩu chữ dính liền -> "KHÁNHJunior" -> embedding cắt
                // word-piece sai). Thứ tự word giữa 2 cột có thể lộn xộn -> không sao.
                var words = page.GetWords().Select(w => w.Text);
                sb.AppendLine(string.Join(' ', words));
            }
        }

        // Gom nhiều dấu cách / xuống dòng liên tiếp thành 1 dấu cách.
        string text = Regex.Replace(sb.ToString(), @"\s+", " ").Trim();

        PdfKind kind = text.Length < CharThreshold
            ? PdfKind.NeedsManualEdit
            : PdfKind.HasText;

        return new PdfExtractResult(kind, text, pageCount, text.Length);
    }
}
