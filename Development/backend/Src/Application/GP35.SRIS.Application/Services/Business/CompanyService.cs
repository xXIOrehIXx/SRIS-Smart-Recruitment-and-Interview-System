using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services;

public class CompanyService : BaseService<CompanyService>, ICompanyService
{
  public CompanyService(IServiceProvider serviceProvider) : base(serviceProvider)
  {
  }

  public async Task<CompanyGetDto> GetByCompanyId(long companyId)
  {
    var companyRepo = _serviceProvider.GetRequiredService<ICompanyRepo>();

    var company = await companyRepo.GetByCompanyId(companyId);

    return _mapper.Map<Company, CompanyGetDto>(company);
  }
}