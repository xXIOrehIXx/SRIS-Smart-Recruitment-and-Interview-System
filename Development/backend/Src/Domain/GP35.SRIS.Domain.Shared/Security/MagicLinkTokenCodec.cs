using System.Security.Cryptography;
using System.Text;

namespace GP35.SRIS.Domain.Shared.Security;

/// <summary>
/// Mã hóa/giải token magic link của ứng viên (docs 5.13).
///
/// Token gốc = "{companyId}.{32 byte ngẫu nhiên base64url}". Tiền tố companyId chỉ là
/// "gợi ý định tuyến" để middleware set tenant (RLS + Global Query Filter) TRƯỚC khi tra DB —
/// KHÔNG phải lớp bảo mật. Quyền truy cập nằm ở 32 byte bí mật: chỉ ai có token gốc mới tạo
/// đúng <see cref="Hash"/> để khớp dòng trong DB. DB chỉ lưu HASH (SHA-256 hex), không lưu gốc.
/// </summary>
public static class MagicLinkTokenCodec
{
    private const int SecretBytes = 32;

    /// <summary>Sinh token gốc mới gắn companyId. Trả token để nhúng vào URL (chỉ trả về 1 lần).</summary>
    public static string Generate(long companyId)
    {
        var secret = Base64UrlEncode(RandomNumberGenerator.GetBytes(SecretBytes));
        return $"{companyId}.{secret}";
    }

    /// <summary>Tách companyId từ tiền tố token (cho middleware set tenant). False nếu sai định dạng.</summary>
    public static bool TryParseCompanyId(string? rawToken, out long companyId)
    {
        companyId = 0;
        if (string.IsNullOrWhiteSpace(rawToken)) return false;

        var dot = rawToken.IndexOf('.');
        if (dot <= 0) return false;

        return long.TryParse(rawToken.AsSpan(0, dot), out companyId) && companyId > 0;
    }

    /// <summary>SHA-256 token gốc -> hex thường (64 ký tự, khớp cột CHAR(64)).</summary>
    public static string Hash(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken));
        return Convert.ToHexStringLower(bytes);
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
