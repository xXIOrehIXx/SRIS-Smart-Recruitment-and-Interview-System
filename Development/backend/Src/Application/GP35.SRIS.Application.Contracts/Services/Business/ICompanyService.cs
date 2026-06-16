using GP35.SRIS.Application.Contracts.Dtos;

namespace GP35.SRIS.Application.Contracts;

public interface ICompanyService : IBaseService
{
  Task<CompanyGetDto> GetByCompanyId(long companyId);
}