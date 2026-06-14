using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Domain;

namespace GP35.SRIS.Application.Contracts.Services;

public interface IUserService : IBaseService
{
  Task<UserGetDto> GetByEmail(string email);
}
