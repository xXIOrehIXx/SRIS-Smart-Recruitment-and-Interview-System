namespace GP35.SRIS.Lib.Services.Pdf;

/// <summary>
/// Tải logo công ty (<c>Company.logo_url</c>) về dạng bytes để nhúng vào đầu thư mời.
/// Best-effort: link hỏng / chậm / không phải ảnh -> trả null, thư vẫn in bình thường.
/// </summary>
public interface IBrandLogoFetcher
{
    Task<byte[]?> TryGetAsync(string? logoUrl, CancellationToken cancellationToken = default);
}
