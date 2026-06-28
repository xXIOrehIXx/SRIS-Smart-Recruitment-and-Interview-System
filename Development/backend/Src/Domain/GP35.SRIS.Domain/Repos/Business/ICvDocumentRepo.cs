using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Thông tin file gốc của 1 CV (file_url = object key trong storage).</summary>
public record CvFileInfo(string? FileUrl, string? FileName, string? MimeType, string? CandidateName);

/// <summary>1 dòng kết quả Talent Pool: CV cũ gần JD (Distance nhỏ = hợp nhiều). UploadedAt để tính "tuổi CV".</summary>
public record TalentPoolRow(
    long CvId,
    long CandidateId,
    string CandidateName,
    DateTime? UploadedAt,
    double Distance);

public interface ICvDocumentRepo : IBaseRepo<long, CvDocument>
{
    /// <summary>
    /// Thêm 1 CvDocument (kèm embedding nếu có) và trả về cv_id vừa sinh.
    /// Vector được CAST chuỗi JSON -> VECTOR(1024) ở phía SQL Server.
    /// </summary>
    Task<long> InsertAsync(CvDocument cv, float[]? embedding);

    /// <summary>Lấy thông tin file gốc (object key + tên + mime) của 1 CV, lọc theo company.</summary>
    Task<CvFileInfo?> GetFileInfoAsync(long companyId, long cvId);

    /// <summary>Lấy text đã bóc từ CV (để chấm nền — Cách A). Null nếu không thấy / chưa có text.</summary>
    Task<string?> GetExtractedTextAsync(long companyId, long cvId);

    /// <summary>
    /// Cập nhật riêng vector embedding cho 1 CV đã lưu (CAST JSON -> VECTOR(1024)). Dùng khi chấm nền:
    /// CV được lưu trước với embedding NULL, worker sinh vector rồi cập nhật sau.
    /// </summary>
    Task UpdateEmbeddingAsync(long companyId, long cvId, float[] embedding);

    /// <summary>
    /// Talent Pool (Việc 13): ĐẢO CHIỀU vector search — quét kho CvDocument CŨ của công ty, lấy Top N
    /// CV gần embedding của JD. LUÔN kèm company_id (cô lập tenant). Chỉ CV còn "tươi" (created_at trong
    /// withinMonths gần đây), CHƯA ứng vào chính job này, và ứng viên CHƯA được tuyển (HIRED) ở bất kỳ
    /// job nào (đã là nhân viên -> bỏ). Sắp xếp Distance tăng dần (gần nhất trước).
    /// </summary>
    Task<IReadOnlyList<TalentPoolRow>> GetTalentPoolByJobAsync(
        long companyId, long jobId, int withinMonths, int topN);
}
