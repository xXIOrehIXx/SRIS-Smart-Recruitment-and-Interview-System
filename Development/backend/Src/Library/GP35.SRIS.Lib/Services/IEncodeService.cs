namespace GP35.SRIS.Lib.Services;

public interface IEncodeService
{
  string SHA256WithSalt(string input, string salt);
}
