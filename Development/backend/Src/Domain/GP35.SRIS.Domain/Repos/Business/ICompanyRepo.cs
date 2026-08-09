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
  /// Cập nhật hồ sơ công ty (name/logo/primary_color/ngành + liên hệ in trên thư mời nhận việc).
  /// Trả về company sau cập nhật, hoặc null nếu không tồn tại.
  /// Trường null trong tham số = giữ nguyên giá trị hiện tại.
  /// Riêng <paramref name="defaultBenefits"/>: chuỗi RỖNG = xoá hết (khác null = giữ nguyên).
  /// </summary>
  Task<Company?> UpdateBrandAsync(
      long companyId, string? name, string? logoUrl, string? primaryColor,
      string? address, string? contactEmail, string? phone, string? defaultBenefits = null);

  /// <summary>Tạo công ty mới (đăng ký) — Company không dưới RLS nên insert thẳng. Trả company_id.</summary>
  Task<long> InsertAsync(Company company);

  /// <summary>
  /// Cập nhật cấu hình SMTP riêng của công ty (per-tenant email — Phase 2).
  /// <paramref name="password"/> = null giữ nguyên mật khẩu cũ (form để trống = không đổi).
  /// Trả company sau cập nhật, null nếu không tồn tại.
  /// </summary>
  Task<Company?> UpdateSmtpAsync(
      long companyId, string? host, int? port, string? username, string? password, string? fromEmail);
}