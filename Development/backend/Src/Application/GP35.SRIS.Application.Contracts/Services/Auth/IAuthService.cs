using GP35.SRIS.Application.Contracts.Dtos;
namespace GP35.SRIS.Application.Contracts;

public interface IAuthService : IBaseService
{
  Task<LoginResult> LoginAsync(string username, string password);
}
