using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

public interface ICompanyRepo : IBaseRepo<long, Company>
{
  Task<Company> GetByCompanyId(long companyId);
}