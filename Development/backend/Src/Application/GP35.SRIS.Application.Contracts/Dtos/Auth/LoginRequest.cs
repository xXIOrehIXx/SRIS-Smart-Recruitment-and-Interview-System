using System.Text.Json.Serialization;

namespace GP35.SRIS.Application.Contracts.Dtos
{
  public class LoginRequest
  {
    [JsonPropertyName("email")]
    public string Email { get; set; }

    [JsonPropertyName("password")]
    public string Password { get; set; }
  }
}
