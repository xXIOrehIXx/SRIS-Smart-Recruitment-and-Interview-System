using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

public interface ICompanyRepo : IBaseRepo<long, Company>
{
  Task<Company> GetByCompanyId(long companyId);

  /// <summary>
  /// Tra công ty theo slug (routing Career Site công khai `/t/{slug}`). Company là bảng tenant
  /// gốc (không có cột company_id, KHÔNG nằm dưới RLS) nên tra được mà chưa cần SESSION_CONTEXT.
  /// Trả null nếu không có slug khớp.
  /// </summary>
  Task<Company?> GetBySlugAsync(string slug);

  /// <summary>
  /// Cập nhật brand (name/logo/primary_color) của công ty. Trả về company sau cập nhật,
  /// hoặc null nếu không tồn tại. Trường null trong tham số = giữ nguyên giá trị hiện tại.
  /// </summary>
  Task<Company?> UpdateBrandAsync(long companyId, string? name, string? logoUrl, string? primaryColor);
}