using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Tầng vector từng-đoạn của CV (docs 5.18) — phục vụ chấm theo tiêu chí.</summary>
public interface ICvChunkRepo : IBaseRepo<long, CvChunk>
{
    /// <summary>CV này đã có chunk kèm embedding chưa (đã chunk lần nào chưa)?</summary>
    Task<bool> HasEmbeddedChunksAsync(long companyId, long cvId);

    /// <summary>Xóa chunk cũ (nếu có) rồi ghi bộ chunk mới kèm vector — chunk lại = thay trọn bộ.</summary>
    Task ReplaceChunksAsync(long companyId, long cvId, IReadOnlyList<(string Content, float[] Embedding)> chunks);
}
