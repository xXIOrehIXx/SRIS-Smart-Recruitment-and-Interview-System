using System.Globalization;
using System.Text;
using ClosedXML.Excel;

namespace GP35.SRIS.Lib.Services.Excel;

/// <summary>
/// Sinh file .xlsx danh sách ứng viên bằng ClosedXML (V047).
///
/// <para>
/// Xuất file THẬT (.xlsx) chứ không phải CSV: người dùng mở bằng Excel tiếng Việt, mà CSV thì
/// dấu phân cách và bảng mã phụ thuộc locale của từng máy — đúng thứ hỏng ngay lúc demo.
/// </para>
/// </summary>
public class CandidateExcelExporter : ICandidateExcelExporter
{
    private const string SheetName = "Ứng viên";

    public byte[] Generate(CandidateExportModel model)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add(SheetName);

        // ----- Đầu file: vị trí + thời điểm xuất -----
        sheet.Cell(1, 1).Value = $"Danh sách ứng viên — {model.JobTitle}";
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Cell(1, 1).Style.Font.FontSize = 14;
        sheet.Range(1, 1, 1, Headers.Length).Merge();

        var subtitle = model.CompanyName is { Length: > 0 }
            ? $"{model.CompanyName} · Xuất lúc {model.ExportedAt:HH:mm dd/MM/yyyy}"
            : $"Xuất lúc {model.ExportedAt:HH:mm dd/MM/yyyy}";
        sheet.Cell(2, 1).Value = subtitle;
        sheet.Cell(2, 1).Style.Font.FontColor = XLColor.Gray;
        sheet.Range(2, 1, 2, Headers.Length).Merge();

        // ----- Hàng tiêu đề -----
        const int headerRow = 4;
        for (var i = 0; i < Headers.Length; i++)
        {
            var cell = sheet.Cell(headerRow, i + 1);
            cell.Value = Headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#EFF3EA");
            cell.Style.Alignment.WrapText = true;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        }

        // ----- Dữ liệu -----
        var row = headerRow + 1;
        foreach (var r in model.Rows)
        {
            var col = 1;
            sheet.Cell(row, col++).Value = row - headerRow;          // STT
            sheet.Cell(row, col++).Value = r.CandidateName;
            sheet.Cell(row, col++).Value = r.CandidateEmail;
            // Số điện thoại là CHỮ: để Excel tự đoán thì "0912..." rụng số 0 đầu.
            var phone = sheet.Cell(row, col++);
            phone.Value = r.CandidatePhone ?? "";
            phone.Style.NumberFormat.Format = "@";
            sheet.Cell(row, col++).Value = r.Source ?? "";
            sheet.Cell(row, col++).Value = r.StateLabel;
            sheet.Cell(row, col++).Value = r.RejectReason ?? "";

            var applied = sheet.Cell(row, col++);
            if (r.AppliedAt is { } at)
            {
                applied.Value = at;
                applied.Style.DateFormat.Format = "dd/mm/yyyy hh:mm";
            }

            // Hồ sơ chưa phân tích: ô điểm để TRỐNG. Ghi 0 là đổ oan cho hồ sơ chưa ai đọc —
            // cùng lý do Kanban xếp nhóm này xuống cuối thay vì cho 0 điểm (V046).
            var score = sheet.Cell(row, col++);
            if (r.FitScore is { } fit) score.Value = fit;

            sheet.Cell(row, col++).Value = r.FitLabel ?? "";
            sheet.Cell(row, col++).Value = r.Summary ?? "";
            sheet.Cell(row, col++).Value = r.Matched ?? "";
            sheet.Cell(row, col++).Value = r.Missing ?? "";
            sheet.Cell(row, col).Value = r.CvFileName ?? "";
            row++;
        }

        // ----- Trình bày -----
        var lastRow = Math.Max(row - 1, headerRow);
        sheet.Range(headerRow, 1, lastRow, Headers.Length)
            .Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        sheet.Range(headerRow, 1, lastRow, Headers.Length)
            .Style.Border.InsideBorder = XLBorderStyleValues.Hair;
        sheet.SheetView.FreezeRows(headerRow);
        sheet.Range(headerRow, 1, lastRow, Headers.Length).SetAutoFilter();

        sheet.Columns().AdjustToContents(5d, 42d);
        // Ba cột văn bản dài: khóa bề rộng + xuống dòng, không thì một bản tóm tắt CV kéo bảng
        // rộng ra vài màn hình.
        foreach (var wide in new[] { 11, 12, 13 })
        {
            sheet.Column(wide).Width = 52;
            sheet.Column(wide).Style.Alignment.WrapText = true;
        }
        sheet.Rows(headerRow + 1, lastRow).Height = 15;

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public string BuildFileName(CandidateExportModel model)
    {
        var title = RemoveDiacritics(model.JobTitle ?? "vi-tri").Replace(' ', '-');
        var safe = new string(title.Where(c => char.IsLetterOrDigit(c) || c == '-').ToArray()).Trim('-');
        if (string.IsNullOrEmpty(safe)) safe = "vi-tri";
        if (safe.Length > 60) safe = safe[..60].Trim('-');
        return $"Ung-vien-{safe}-{model.ExportedAt:dd-MM-yyyy}.xlsx";
    }

    private static readonly string[] Headers =
    {
        "STT", "Họ và tên", "Email", "Điện thoại", "Nguồn", "Trạng thái", "Lý do từ chối",
        "Ngày nộp", "Điểm phù hợp", "Đề xuất của AI", "Tóm tắt CV", "Yêu cầu đạt",
        "Yêu cầu còn thiếu", "File CV"
    };

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
