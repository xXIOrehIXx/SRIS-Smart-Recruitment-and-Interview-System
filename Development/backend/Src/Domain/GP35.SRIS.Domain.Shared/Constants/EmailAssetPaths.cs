using System.Text.RegularExpressions;

namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>
/// Chỗ ở của ảnh dùng trong email (logo, banner): thư mục trong storage và đường dẫn công khai
/// tương ứng. Hai thứ này phải khớp nhau nên để chung một chỗ — nơi phục vụ ảnh
/// (EmailAssetController) và nơi nhúng ảnh vào thư đều đọc từ đây.
/// </summary>
public static class EmailAssetPaths
{
    /// <summary>Thư mục ảnh email trong storage. Chỉ đường dẫn khớp tiền tố này mới phục vụ công khai.</summary>
    public const string Folder = "email-assets";

    /// <summary>Tiền tố URL công khai phục vụ ảnh email.</summary>
    public const string PublicPrefix = "/api/public/email-assets/";

    private static readonly Regex PublicUrl = new(
        @"/api/public/email-assets/(?<company>\d+)/(?<file>[^/?#]+)$",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Key của ảnh trong storage.</summary>
    public static string ObjectName(long companyId, string fileName) => $"{Folder}/{companyId}/{fileName}";

    /// <summary>
    /// URL ảnh email do CHÍNH hệ thống này phát ra -> key trong storage; URL của nơi khác -> null.
    ///
    /// <para>Đọc thẳng từ storage thay vì để server tự gọi HTTP vào URL đó: lúc demo/dev URL là
    /// <c>localhost</c> (gọi ra ngoài không tới) và nếu chiều theo URL người dùng nhập thì server
    /// thành công cụ dò mạng nội bộ (SSRF).</para>
    /// </summary>
    public static string? TryGetObjectName(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;

        // Bỏ query/fragment trước khi so khớp — URL có thể kèm ?v=... do cache-busting.
        var path = url.Split('?')[0].Split('#')[0];

        var match = PublicUrl.Match(path);
        return match.Success
            ? ObjectName(long.Parse(match.Groups["company"].Value), match.Groups["file"].Value)
            : null;
    }
}
