namespace GP35.SRIS.Lib.Services;

public class EncodeService : IEncodeService
{
  public string SHA256WithSalt(string value, string salt)
  {
    byte[] valueBytes = System.Text.Encoding.UTF8.GetBytes(value + salt);
    byte[] saltBytes = Convert.FromBase64String(salt);

    var valueWithSaltBytes = new byte[valueBytes.Length + saltBytes.Length];

    Buffer.BlockCopy(valueBytes, 0, valueWithSaltBytes, 0, valueBytes.Length);
    Buffer.BlockCopy(saltBytes, 0, valueWithSaltBytes, valueBytes.Length, saltBytes.Length);

    using (var sha256 = System.Security.Cryptography.SHA256.Create())
    {
      byte[] hashBytes = sha256.ComputeHash(valueWithSaltBytes);
      return Convert.ToBase64String(hashBytes);
    }
  }
}
