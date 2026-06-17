using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Thông tin file gốc của 1 CV (file_url = object key trong storage).</summary>
public record CvFileInfo(string? FileUrl, string? FileName, string? MimeType);

public interface ICvDocumentRepo : IBaseRepo<long, CvDocument>
{
    /// <summary>
    /// Thêm 1 CvDocument (kèm embedding nếu có) và trả về cv_id vừa sinh.
    /// Vector được CAST chuỗi JSON -> VECTOR(384) ở phía SQL Server.
    /// </summary>
    Task<long> InsertAsync(CvDocument cv, float[]? embedding);

    /// <summary>Lấy thông tin file gốc (object key + tên + mime) của 1 CV, lọc theo company.</summary>
    Task<CvFileInfo?> GetFileInfoAsync(long companyId, long cvId);
}
