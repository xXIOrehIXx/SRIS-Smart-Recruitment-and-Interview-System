using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

public interface IUserRepo : IBaseRepo<Guid, User>
{
  Task<User> GetByEmail(string email);
}
