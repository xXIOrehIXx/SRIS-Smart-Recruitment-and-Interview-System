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

    /// <summary>Lấy text đã bóc từ CV (để chấm nền — Cách A). Null nếu không thấy / chưa có text.</summary>
    Task<string?> GetExtractedTextAsync(long companyId, long cvId);
}
