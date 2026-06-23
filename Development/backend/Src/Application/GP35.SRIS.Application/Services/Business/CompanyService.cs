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

  public async Task<CompanyGetDto> UpdateBrandAsync(long companyId, UpdateBrandDto dto)
  {
    var companyRepo = _serviceProvider.GetRequiredService<ICompanyRepo>();

    var company = await companyRepo.UpdateBrandAsync(
        companyId,
        Normalize(dto.Name),
        Normalize(dto.LogoUrl),
        Normalize(dto.PrimaryColor));

    if (company is null)
      throw new KeyNotFoundException($"Không tìm thấy công ty (company_id={companyId}).");

    return _mapper.Map<Company, CompanyGetDto>(company);
  }

  // Trắng -> null (giữ nguyên giá trị cũ); ngược lại trim.
  private static string? Normalize(string? value) =>
      string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}