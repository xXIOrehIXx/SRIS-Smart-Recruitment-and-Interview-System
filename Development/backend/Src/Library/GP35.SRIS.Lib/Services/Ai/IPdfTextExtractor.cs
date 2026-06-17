namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>Phân loại 1 file PDF sau khi extract.</summary>
public enum PdfKind
{
    /// <summary>Loại 1 + 2: bóc được text -> đẩy tiếp sang luồng chấm điểm.</summary>
    HasText,

    /// <summary>Loại 3: PDF scan ảnh, text rỗng -> cần HR nhập tay (Manual Edit).</summary>
    NeedsManualEdit
}

/// <summary>Kết quả extract: loại PDF + text bóc được + vài thông số để hiển thị.</summary>
public record PdfExtractResult(PdfKind Kind, string Text, int PageCount, int CharCount);

/// <summary>Bóc text từ file PDF. Stateless — không đụng DB, không biết tenant.</summary>
public interface IPdfTextExtractor
{
    /// <summary>Đọc PDF từ mảng byte. Không ném lỗi cho PDF scan ảnh (trả Kind = NeedsManualEdit).</summary>
    PdfExtractResult Extract(byte[] pdfBytes);
}
