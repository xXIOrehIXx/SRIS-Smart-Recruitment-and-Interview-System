namespace GP35.SRIS.Lib.Services.Ai;

/// <summary>
/// Client gọi Python AI service để sinh vector embedding cho 1 đoạn text.
/// Vector trả về dài <see cref="EmbeddingDimension"/> chiều, đã chuẩn hóa.
/// </summary>
public interface IEmbeddingClient
{
    /// <summary>Số chiều vector (khớp cột VECTOR(1024) trong DB — model BAAI/bge-m3).</summary>
    const int EmbeddingDimension = 1024;

    /// <summary>Nhận text -> trả về vector embedding. Ném khi không gọi được AI service.</summary>
    Task<float[]> EmbedAsync(string text);
}
