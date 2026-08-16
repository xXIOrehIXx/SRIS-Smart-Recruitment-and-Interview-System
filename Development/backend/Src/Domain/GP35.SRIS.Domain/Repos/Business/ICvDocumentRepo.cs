using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Thông tin file gốc của 1 CV (file_url = object key trong storage).</summary>
public record CvFileInfo(string? FileUrl, string? FileName, string? MimeType, string? CandidateName);

public interface ICvDocumentRepo : IBaseRepo<long, CvDocument>
{
    /// <summary>Thêm 1 CvDocument và trả về cv_id vừa sinh.</summary>
    Task<long> InsertAsync(CvDocument cv);

    /// <summary>Lấy thông tin file gốc (object key + tên + mime) của 1 CV, lọc theo company.</summary>
    Task<CvFileInfo?> GetFileInfoAsync(long companyId, long cvId);

    /// <summary>Lấy text đã bóc từ CV (đầu vào cho luồng sàng lọc). Null nếu không thấy / chưa có text.</summary>
    Task<string?> GetExtractedTextAsync(long companyId, long cvId);

    /// <summary>
    /// Ghi đè text đã bóc của 1 CV. Dùng khi bóc lại từ file gốc bằng bản
    /// <c>PdfTextExtractor</c> mới (giữ thứ tự đọc) — CV nhận trước đó được bóc bằng bản cũ
    /// vốn cố ý vứt thứ tự chữ, đọc bằng AI thì sai. Trả số dòng cập nhật.
    /// </summary>
    Task<int> UpdateExtractedTextAsync(long companyId, long cvId, string extractedText);
}
