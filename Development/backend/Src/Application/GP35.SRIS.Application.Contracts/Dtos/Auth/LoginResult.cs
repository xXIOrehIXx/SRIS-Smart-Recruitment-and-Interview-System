using System.Text.Json.Serialization;

namespace GP35.SRIS.Application.Contracts.Dtos
{
  public class LoginResult
  {
    [JsonPropertyName("accessToken")]
    public string AccessToken { get; set; }

    [JsonPropertyName("refreshToken")]
    public string RefreshToken { get; set; }

    [JsonPropertyName("companyId")]
    public string CompanyId { get; set; }
  }
}
