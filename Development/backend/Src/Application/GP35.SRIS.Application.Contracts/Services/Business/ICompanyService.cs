using GP35.SRIS.Application.Contracts.Dtos;

namespace GP35.SRIS.Application.Contracts;

public interface ICompanyService : IBaseService
{
  Task<CompanyGetDto> GetByCompanyId(long companyId);

  /// <summary>Cập nhật brand (name/logo/màu) của công ty hiện tại. Trả về company sau khi cập nhật.</summary>
  Task<CompanyGetDto> UpdateBrandAsync(long companyId, UpdateBrandDto dto);
}