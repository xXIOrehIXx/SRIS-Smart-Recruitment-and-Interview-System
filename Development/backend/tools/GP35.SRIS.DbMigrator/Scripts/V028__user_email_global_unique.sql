/* =============================================================================
   V028 — Email đăng nhập duy nhất TOÀN HỆ THỐNG (không còn theo từng công ty).

   Trước: UQ_User_company_email UNIQUE (company_id, email)
     -> cùng một email được phép là tài khoản ở nhiều công ty.
   Nhưng code xác thực lại giả định ngược lại: UserRepo.GetByEmail dùng
   FirstOrDefault xuyên tenant, không ORDER BY. Nếu email trùng ở 2 công ty thì
   login và quên-mật-khẩu chỉ với tới MỘT tài khoản, và là tài khoản nào thì
   không xác định — công ty còn lại vĩnh viễn không vào được.

   Chốt 03/08/2026: giữ "đơn giản là mặc định" -> 1 email = 1 tài khoản, không
   cần thêm bước chọn công ty ở màn đăng nhập. Ai làm cho 2 công ty thì dùng 2
   email khác nhau.

   IX_User_company (V001) vẫn còn nên truy vấn lọc theo company_id không bị ảnh
   hưởng khi bỏ constraint cũ. Unique index mới trên (email) đồng thời phục vụ
   luôn đường tra lúc login.
   ============================================================================= */

SET XACT_ABORT ON;
GO

/* ---------------------------------------------------------------------------
   1) Chặn trước: dữ liệu đang có email trùng thì KHÔNG thể siết unique.
   Báo lỗi kèm danh sách để người vận hành sửa tay, thay vì để CREATE INDEX
   ném lỗi khó hiểu (host tự chạy migration lúc khởi động -> phải nói rõ).
   RLS lọc theo SESSION_CONTEXT nên tắt policy trong lúc kiểm để nhìn xuyên tenant.
   --------------------------------------------------------------------------- */
ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
GO

DECLARE @dups NVARCHAR(MAX);

SELECT @dups = STRING_AGG(
        CONVERT(NVARCHAR(MAX), email) + N' (company_id: ' + CacCompany + N')', N'; ')
FROM (
    SELECT email, STRING_AGG(CONVERT(NVARCHAR(MAX), company_id), N',') AS CacCompany
    FROM dbo.[User]
    GROUP BY email
    HAVING COUNT(*) > 1
) d;

IF @dups IS NOT NULL
BEGIN
    -- Bật lại policy trước khi ném lỗi, tránh để DB ở trạng thái hở tenant.
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);

    DECLARE @msg NVARCHAR(2048) =
        N'V028 dừng: email đang trùng giữa các công ty nên không thể đặt UNIQUE(email). '
      + N'Đổi email cho các tài khoản sau rồi chạy lại: ' + LEFT(@dups, 1500);
    THROW 50028, @msg, 1;
END
GO

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
GO

/* ---------------------------------------------------------------------------
   2) Bỏ unique cũ theo (company_id, email), siết unique mới theo (email).
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.key_constraints
           WHERE name = 'UQ_User_company_email' AND parent_object_id = OBJECT_ID('dbo.[User]'))
BEGIN
    ALTER TABLE dbo.[User] DROP CONSTRAINT UQ_User_company_email;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints
               WHERE name = 'UQ_User_email' AND parent_object_id = OBJECT_ID('dbo.[User]'))
BEGIN
    ALTER TABLE dbo.[User] ADD CONSTRAINT UQ_User_email UNIQUE (email);
END
GO
