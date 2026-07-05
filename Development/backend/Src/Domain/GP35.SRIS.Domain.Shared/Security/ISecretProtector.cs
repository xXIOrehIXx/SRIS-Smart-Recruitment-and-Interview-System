namespace GP35.SRIS.Domain.Shared.Security;

/// <summary>
/// Mã hoá/giải mã bí mật lưu ở DB (vd mật khẩu SMTP per-tenant). Impl dùng ASP.NET Data Protection
/// (tự quản khoá) ở tầng host. Best-effort giải mã: giá trị cũ chưa mã hoá -> trả nguyên (tương thích ngược).
/// </summary>
public interface ISecretProtector
{
    /// <summary>Mã hoá chuỗi để lưu DB. Trống -> trả nguyên.</summary>
    string Protect(string plaintext);

    /// <summary>Giải mã chuỗi đọc từ DB. Lỗi/không phải ciphertext -> trả nguyên (giá trị cũ chưa mã hoá).</summary>
    string Unprotect(string ciphertext);
}
