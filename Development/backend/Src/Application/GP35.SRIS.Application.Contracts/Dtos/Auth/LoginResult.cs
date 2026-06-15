namespace GP35.SRIS.Application.Contracts.Dtos
{
  public class LoginResult
  {
        public string AccessToken { get; set; }
        public string RefreshToken { get; set; }
        public string CompanyId { get; set; }
    }
}
