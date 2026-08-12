using System.Collections.Concurrent;
using System.Net;
using System.Net.Sockets;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Storage;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Lib.Services.Pdf;

/// <summary>
/// Tải logo brand cho đầu thư mời. Nguyên tắc: KHÔNG BAO GIỜ làm hỏng lá thư —
/// mọi lỗi (URL sai, host chết, file khổng lồ, không phải ảnh) đều trả null và chỉ ghi log.
///
/// Có cache trong bộ nhớ vì một thư mời được mở/tải lại nhiều lần (ứng viên + HR),
/// không việc nào đáng phải bắn HTTP ra ngoài mỗi lần.
/// </summary>
public class BrandLogoFetcher : IBrandLogoFetcher
{
    /// <summary>Logo lớn hơn mức này gần như chắc chắn là nhầm file (ảnh nền, PSD export...).</summary>
    private const int MaxBytes = 2 * 1024 * 1024;

    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(4);
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(30);

    private static readonly ConcurrentDictionary<string, (DateTime Expires, byte[]? Data)> Cache = new();

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IFileStorageService? _storage;
    private readonly ILogger _logger;

    public BrandLogoFetcher(IServiceProvider serviceProvider)
    {
        _httpClientFactory = serviceProvider.GetRequiredService<IHttpClientFactory>();
        _storage = serviceProvider.GetService<IFileStorageService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<BrandLogoFetcher>();
    }

    public async Task<byte[]?> TryGetAsync(string? logoUrl, CancellationToken cancellationToken = default)
    {
        var url = logoUrl?.Trim();
        if (string.IsNullOrEmpty(url)) return null;

        if (Cache.TryGetValue(url, out var hit) && hit.Expires > DateTime.UtcNow)
            return hit.Data;

        var data = await LoadAsync(url, cancellationToken);
        // Cache cả kết quả null: URL hỏng thì đừng thử lại (và chờ timeout) ở mỗi lần mở thư.
        Cache[url] = (DateTime.UtcNow.Add(CacheTtl), data);
        return data;
    }

    // ============================================================

    private async Task<byte[]?> LoadAsync(string url, CancellationToken cancellationToken)
    {
        try
        {
            if (url.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                return Validate(ReadDataUri(url), url);

            // Logo do chính hệ thống lưu -> đọc thẳng từ kho, không đi vòng qua HTTP. Lúc demo
            // URL là localhost (bị chặn ở IsPrivateHost bên dưới) nên nếu chờ HTTP thì thư mời
            // luôn mất logo trên máy dev.
            var objectName = EmailAssetPaths.TryGetObjectName(url);
            if (objectName is not null && _storage is not null)
            {
                var stored = await _storage.DownloadAsync(objectName, cancellationToken);
                return Validate(stored?.Content, url);
            }

            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                _logger.Warning("Offer letter: bỏ qua logo, URL không hợp lệ ({Url}).", url);
                return null;
            }

            // Chặn SSRF: server sẽ tự đi gọi URL mà admin nhập, không để nó dò mạng nội bộ.
            if (IsPrivateHost(uri))
            {
                _logger.Warning("Offer letter: bỏ qua logo trỏ vào địa chỉ nội bộ ({Host}).", uri.Host);
                return null;
            }

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(Timeout);

            var client = _httpClientFactory.CreateClient();
            using var response = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                _logger.Warning("Offer letter: tải logo thất bại {Status} ({Url}).", (int)response.StatusCode, url);
                return null;
            }

            if (response.Content.Headers.ContentLength > MaxBytes)
            {
                _logger.Warning("Offer letter: logo quá lớn ({Size} bytes) — bỏ qua.",
                    response.Content.Headers.ContentLength);
                return null;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(cts.Token);
            return Validate(bytes, url);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "Offer letter: không tải được logo ({Url}) — in thư không logo.", url);
            return null;
        }
    }

    private byte[]? Validate(byte[]? bytes, string url)
    {
        if (bytes is null || bytes.Length == 0) return null;

        if (bytes.Length > MaxBytes)
        {
            _logger.Warning("Offer letter: logo quá lớn ({Size} bytes) — bỏ qua.", bytes.Length);
            return null;
        }

        // Kiểm magic bytes chứ không tin Content-Type: đưa file lạ cho QuestPDF là nó ném
        // lúc render, tức là vỡ đúng lúc ứng viên bấm tải thư.
        if (!IsSupportedImage(bytes))
        {
            _logger.Warning("Offer letter: logo không phải ảnh PNG/JPEG/GIF/BMP/WEBP ({Url}) — bỏ qua.", url);
            return null;
        }

        return bytes;
    }

    private static byte[]? ReadDataUri(string url)
    {
        var comma = url.IndexOf(',');
        if (comma < 0 || !url.AsSpan(0, comma).Contains("base64", StringComparison.OrdinalIgnoreCase))
            return null;

        return Convert.FromBase64String(url[(comma + 1)..]);
    }

    private static bool IsSupportedImage(byte[] b)
    {
        if (b.Length < 12) return false;

        // PNG
        if (b[0] == 0x89 && b[1] == 0x50 && b[2] == 0x4E && b[3] == 0x47) return true;
        // JPEG
        if (b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF) return true;
        // GIF
        if (b[0] == 0x47 && b[1] == 0x49 && b[2] == 0x46) return true;
        // BMP
        if (b[0] == 0x42 && b[1] == 0x4D) return true;
        // WEBP: "RIFF"...."WEBP"
        if (b[0] == 0x52 && b[1] == 0x49 && b[2] == 0x46 && b[3] == 0x46 &&
            b[8] == 0x57 && b[9] == 0x45 && b[10] == 0x42 && b[11] == 0x50) return true;

        return false;
    }

    /// <summary>Loopback / dải IP nội bộ / .local — không cho thư mời thành công cụ dò mạng.</summary>
    private static bool IsPrivateHost(Uri uri)
    {
        var host = uri.Host;

        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
            host.EndsWith(".local", StringComparison.OrdinalIgnoreCase) ||
            host.EndsWith(".internal", StringComparison.OrdinalIgnoreCase))
            return true;

        if (!IPAddress.TryParse(host, out var ip)) return false;

        if (IPAddress.IsLoopback(ip)) return true;

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var o = ip.GetAddressBytes();
            return o[0] == 10                                   // 10.0.0.0/8
                || (o[0] == 172 && o[1] >= 16 && o[1] <= 31)    // 172.16.0.0/12
                || (o[0] == 192 && o[1] == 168)                 // 192.168.0.0/16
                || (o[0] == 169 && o[1] == 254)                 // link-local (metadata service)
                || o[0] == 0;
        }

        return ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal;
    }
}
