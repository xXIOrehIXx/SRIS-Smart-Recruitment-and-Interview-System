namespace GP35.SRIS.Domain.Shared.Constants;

/// <summary>Hằng số của cơ chế cách ly đa tenant (RLS qua SESSION_CONTEXT('CompanyId')).</summary>
public static class TenantConstants
{
    /// <summary>Khoá session context mà predicate RLS đọc.</summary>
    public const string SessionKey = "CompanyId";

    /// <summary>
    /// Tenant "hệ thống" (V049): tiến trình chạy NGOÀI request — worker hàng đợi, tra cứu
    /// tài khoản lúc đăng nhập — đặt giá trị này để nhìn xuyên mọi công ty.
    ///
    /// Trước V049 những chỗ đó tắt hẳn <c>TenantSecurityPolicy</c> bằng DDL, tức tắt RLS cho
    /// TOÀN database chứ không riêng connection của mình: ba worker cùng tắt/bật mỗi 5 giây
    /// vừa giẫm lên nhau (lượt bóc tiêu chí nằm PENDING cả phút) vừa mở cửa đọc chéo tenant.
    /// Đừng quay lại cách đó.
    /// </summary>
    public const long SystemCompanyId = -1;
}
