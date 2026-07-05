using System.Security.Cryptography;
using System.Text;
using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Security;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Lib.Services;

/// <summary>
/// Mã hoá bí mật ở DB bằng AES-256 (khoá băm SHA-256 từ Auth:Key trong config — đổi Key = xoay khoá).
/// Ciphertext gắn tiền tố "enc:" -> Unprotect biết cần giải; giá trị KHÔNG có tiền tố coi như
/// plaintext cũ (tương thích ngược). Dùng cho smtp_password per-tenant.
/// </summary>
public class AesSecretProtector : ISecretProtector
{
    private const string Prefix = "enc:";
    private readonly byte[] _key;

    public AesSecretProtector(IServiceProvider serviceProvider)
    {
        var seed = serviceProvider.GetRequiredService<DefaultConfig>().Auth?.Key ?? "sris-fallback-secret";
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(seed)); // 32 byte = AES-256
    }

    public string Protect(string plaintext)
    {
        if (string.IsNullOrEmpty(plaintext)) return plaintext;

        using var aes = Aes.Create();
        aes.Key = _key;
        aes.GenerateIV();
        using var enc = aes.CreateEncryptor();
        var data = Encoding.UTF8.GetBytes(plaintext);
        var cipher = enc.TransformFinalBlock(data, 0, data.Length);

        var outBytes = new byte[aes.IV.Length + cipher.Length];
        Buffer.BlockCopy(aes.IV, 0, outBytes, 0, aes.IV.Length);
        Buffer.BlockCopy(cipher, 0, outBytes, aes.IV.Length, cipher.Length);
        return Prefix + Convert.ToBase64String(outBytes);
    }

    public string Unprotect(string ciphertext)
    {
        if (string.IsNullOrEmpty(ciphertext) || !ciphertext.StartsWith(Prefix, StringComparison.Ordinal))
            return ciphertext; // plaintext cũ (chưa mã hoá) -> dùng nguyên

        try
        {
            var raw = Convert.FromBase64String(ciphertext[Prefix.Length..]);
            using var aes = Aes.Create();
            aes.Key = _key;
            var iv = new byte[16];
            Buffer.BlockCopy(raw, 0, iv, 0, 16);
            aes.IV = iv;
            using var dec = aes.CreateDecryptor();
            var plain = dec.TransformFinalBlock(raw, 16, raw.Length - 16);
            return Encoding.UTF8.GetString(plain);
        }
        catch
        {
            return ciphertext; // giải mã lỗi -> trả nguyên (không làm rớt gửi mail)
        }
    }
}
