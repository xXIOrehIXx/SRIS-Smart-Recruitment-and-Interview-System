namespace GP35.SRIS.Storage;

/// <summary>Kết quả sau khi lưu 1 file lên object storage.</summary>
public record StoredFileInfo(string ObjectName, long Size, string ContentType);

/// <summary>
/// Abstraction lưu trữ file (object storage). Hiện cài bằng MinIO; vì MinIO tương thích
/// API S3 nên sau này deploy chỉ cần đổi implementation/đổi config sang Amazon S3.
/// Tầng nghiệp vụ chỉ phụ thuộc interface này, không biết MinIO hay S3.
/// </summary>
public interface IFileStorageService
{
    /// <summary>Tải nội dung lên storage với key <paramref name="objectName"/>. Trả về thông tin file đã lưu.</summary>
    Task<StoredFileInfo> UploadAsync(
        string objectName, Stream content, long size, string contentType,
        CancellationToken cancellationToken = default);

    /// <summary>Tạo URL tải tạm thời (presigned) cho 1 object — dùng khi cần cho client tải file gốc.</summary>
    Task<string> GetPresignedUrlAsync(
        string objectName, int expirySeconds = 3600,
        CancellationToken cancellationToken = default);
}
