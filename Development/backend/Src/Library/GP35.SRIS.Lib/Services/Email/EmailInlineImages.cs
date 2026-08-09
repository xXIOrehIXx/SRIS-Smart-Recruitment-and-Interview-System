using System.Text.RegularExpressions;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Storage;
using MimeKit.Utils;
using Serilog;

namespace GP35.SRIS.Lib.Services.Email;

/// <summary>Một ảnh đã đọc được, chờ đính kèm vào email dưới dạng tài nguyên nhúng (CID).</summary>
public sealed record InlineImage(string Cid, string FileName, byte[] Content, string ContentType);

/// <summary>
/// Nhúng ảnh THẲNG VÀO email thay vì để ứng viên tải về từ máy chủ.
///
/// <para><b>Vì sao cần:</b> ảnh trong email được Gmail/Outlook tải hộ người nhận, từ máy chủ của
/// HỌ — không phải từ máy người nhận. Địa chỉ ảnh trỏ về <c>localhost</c> (lúc demo/dev) hay về
/// mạng nội bộ công ty thì Gmail không tài nào với tới: ứng viên chỉ thấy ô ảnh vỡ kèm dòng chữ
/// thay thế. Kèm luôn ảnh vào thư (chuẩn MIME multipart/related, ảnh mang <c>Content-ID</c> và
/// thẻ img trỏ <c>cid:...</c>) thì ảnh đi cùng lá thư, hiện được cả khi máy chủ không lộ ra
/// Internet, và không bị Gmail chặn như base64.</para>
///
/// <para>Chỉ nhúng ảnh của CHÍNH hệ thống (kho ảnh email) và ảnh dán dạng <c>data:</c>;
/// ảnh trỏ ra CDN/website bên ngoài giữ nguyên — chỗ đó Gmail tải được và không phải việc của ta.</para>
/// </summary>
public static class EmailInlineImages
{
    /// <summary>Ảnh nặng hơn mức này gần như chắc chắn là nhầm file; nhúng vào là thư quá khổ.</summary>
    private const int MaxBytesPerImage = 2 * 1024 * 1024;

    /// <summary>Trần cho cả lá thư — không để một email lôi theo chục megabyte ảnh.</summary>
    private const int MaxBytesTotal = 6 * 1024 * 1024;

    private static readonly Regex ImgSrc = new(
        @"(<img\b[^>]*?\bsrc\s*=\s*)(""|')(?<url>.*?)\2",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex ImgTag = new(
        @"<img\b[^>]*>",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex StyleAttr = new(
        @"\bstyle\s*=\s*(""|')(?<css>.*?)\1",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Regex DataUri = new(
        @"^data:(?<type>image/[\w.+-]+);base64,(?<data>.+)$",
        RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);

    private static readonly Dictionary<string, string> ContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".gif"] = "image/gif",
        [".webp"] = "image/webp",
    };

    /// <summary>
    /// Đổi các thẻ <c>&lt;img&gt;</c> nhúng được sang <c>cid:</c> và trả về ảnh cần đính kèm.
    /// Best-effort: ảnh nào đọc không ra thì để nguyên địa chỉ cũ, KHÔNG làm hỏng việc gửi thư.
    /// </summary>
    public static async Task<(string Html, List<InlineImage> Images)> InlineAsync(
        string? html, IFileStorageService? storage, ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        var images = new List<InlineImage>();

        if (string.IsNullOrEmpty(html) || !html.Contains("<img", StringComparison.OrdinalIgnoreCase))
            return (html ?? "", images);

        // Đọc ảnh cần await, mà Regex.Replace thì không await được -> giải quyết trước, thay sau.
        // Gom theo URL để cùng một logo xuất hiện 3 lần vẫn chỉ đính kèm 1 bản.
        var cidByUrl = new Dictionary<string, string>(StringComparer.Ordinal);
        var totalBytes = 0;

        foreach (var url in ImgSrc.Matches(html).Select(m => m.Groups["url"].Value).Distinct(StringComparer.Ordinal))
        {
            if (cidByUrl.ContainsKey(url)) continue;

            var image = await ReadAsync(url, storage, logger, cancellationToken);
            if (image is null) continue;

            if (totalBytes + image.Value.Content.Length > MaxBytesTotal)
            {
                logger?.Warning("Email: bỏ nhúng ảnh còn lại — tổng ảnh vượt {Max} byte.", MaxBytesTotal);
                break;
            }
            totalBytes += image.Value.Content.Length;

            var cid = MimeUtils.GenerateMessageId();
            cidByUrl[url] = cid;
            images.Add(new InlineImage(cid, image.Value.FileName, image.Value.Content, image.Value.ContentType));
        }

        var rewritten = cidByUrl.Count == 0
            ? html
            : ImgSrc.Replace(html, m =>
            {
                var url = m.Groups["url"].Value;
                var quote = m.Groups[2].Value;
                return cidByUrl.TryGetValue(url, out var cid)
                    ? $"{m.Groups[1].Value}{quote}cid:{cid}{quote}"
                    : m.Value;
            });

        return (MakeImagesResponsive(rewritten), images);
    }

    /// <summary>
    /// Ép mọi ảnh trong thư co theo bề ngang email.
    ///
    /// <para><b>Vì sao phải ép ở đây:</b> ảnh người dùng dán từ Word/Gmail vào ô soạn thảo mang
    /// theo style của chỗ cũ (vd chỉ có <c>border-style:none</c>) — không có
    /// <c>max-width</c> thì ảnh hiện đúng kích thước gốc. Một banner 2813px sẽ phá vỡ khung
    /// 600px, ứng viên phải kéo ngang mới đọc được thư. Người soạn không thấy vấn đề vì trong
    /// ô soạn thảo ảnh đã bị bó theo bề ngang trình duyệt.</para>
    ///
    /// <para>Lưu ý: Outlook bản desktop (dùng engine Word) bỏ qua <c>max-width</c> — ảnh quá khổ
    /// vẫn tràn ở đó. Cách chắc ăn nhất vẫn là tải lên ảnh rộng cỡ 600–1200px.</para>
    /// </summary>
    private static string MakeImagesResponsive(string html) =>
        ImgTag.Replace(html, m =>
        {
            var tag = m.Value;
            var style = StyleAttr.Match(tag);
            var css = style.Success ? style.Groups["css"].Value : "";

            var additions = "";
            if (!css.Contains("max-width", StringComparison.OrdinalIgnoreCase))
                additions += "max-width:100%;";
            if (!css.Contains("height", StringComparison.OrdinalIgnoreCase))
                additions += "height:auto;";
            if (additions.Length == 0) return tag;

            if (!style.Success)
                return tag.Insert(4, $" style=\"{additions}\"");   // ngay sau "<img"

            var merged = css.TrimEnd();
            if (merged.Length > 0 && !merged.EndsWith(';')) merged += ";";
            var quote = style.Groups[1].Value;
            return tag.Remove(style.Index, style.Length)
                      .Insert(style.Index, $"style={quote}{merged}{additions}{quote}");
        });

    // ============================================================

    private static async Task<(byte[] Content, string ContentType, string FileName)?> ReadAsync(
        string url, IFileStorageService? storage, ILogger? logger, CancellationToken cancellationToken)
    {
        try
        {
            if (url.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                return ReadDataUri(url, logger);

            var objectName = EmailAssetPaths.TryGetObjectName(url);
            if (objectName is null || storage is null) return null;

            var file = await storage.DownloadAsync(objectName, cancellationToken);
            if (file is null)
            {
                logger?.Warning("Email: không tìm thấy ảnh {Object} trong kho -> giữ nguyên địa chỉ.", objectName);
                return null;
            }

            if (file.Value.Content.Length > MaxBytesPerImage)
            {
                logger?.Warning("Email: ảnh {Object} nặng {Size} byte -> không nhúng.",
                    objectName, file.Value.Content.Length);
                return null;
            }

            var fileName = objectName[(objectName.LastIndexOf('/') + 1)..];
            var contentType = ContentTypes.TryGetValue(Path.GetExtension(fileName), out var known)
                ? known
                : file.Value.ContentType;

            return (file.Value.Content, contentType, fileName);
        }
        catch (Exception ex)
        {
            logger?.Warning(ex, "Email: đọc ảnh để nhúng thất bại -> giữ nguyên địa chỉ ảnh.");
            return null;
        }
    }

    private static (byte[] Content, string ContentType, string FileName)? ReadDataUri(string url, ILogger? logger)
    {
        var match = DataUri.Match(url);
        if (!match.Success) return null;

        var bytes = Convert.FromBase64String(match.Groups["data"].Value.Trim());
        if (bytes.Length == 0 || bytes.Length > MaxBytesPerImage)
        {
            logger?.Warning("Email: ảnh dán trực tiếp {Size} byte -> không nhúng.", bytes.Length);
            return null;
        }

        var contentType = match.Groups["type"].Value.ToLowerInvariant();
        var ext = ContentTypes.FirstOrDefault(kv => kv.Value == contentType).Key ?? ".png";
        return (bytes, contentType, $"{Guid.NewGuid():N}{ext}");
    }
}
