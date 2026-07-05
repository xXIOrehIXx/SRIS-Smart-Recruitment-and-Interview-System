using GP35.SRIS.Application.Contracts.Dtos;

namespace GP35.SRIS.Application.Contracts;

public interface ICompanyService : IBaseService
{
  Task<CompanyGetDto> GetByCompanyId(long companyId);

  /// <summary>Cập nhật brand (name/logo/màu) của công ty hiện tại. Trả về company sau khi cập nhật.</summary>
  Task<CompanyGetDto> UpdateBrandAsync(long companyId, UpdateBrandDto dto);

  /// <summary>Đọc cấu hình SMTP riêng của công ty (che mật khẩu).</summary>
  Task<CompanySmtpDto> GetSmtpAsync(long companyId);

  /// <summary>Cập nhật SMTP riêng của công ty (per-tenant email). Trả cấu hình sau khi lưu.</summary>
  Task<CompanySmtpDto> UpdateSmtpAsync(long companyId, UpdateSmtpDto dto);

  /// <summary>Gửi 1 email thử bằng SMTP hiện hành của công ty. Trả true nếu gửi thành công.</summary>
  Task<bool> SendTestEmailAsync(long companyId, string toEmail);
}