using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts.Services;
using GP35.SRIS.Domain;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services;

public class UserService : BaseService<UserService>, IUserService
{
  public UserService(IServiceProvider serviceProvider) : base(serviceProvider)
  {
  }
  
  public async Task<UserGetDto> GetByEmail(string email)
  {
    var _userRepo = _serviceProvider.GetRequiredService<IUserRepo>();

    var user = await _userRepo.GetByEmail(email);

    var dto = _mapper.Map<User, UserGetDto>(user);

    return dto;
  }
}
