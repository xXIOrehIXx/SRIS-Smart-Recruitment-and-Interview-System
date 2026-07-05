/* =============================================================================
   MIGRATION V016 — sửa mật khẩu seed test cho ĐÚNG "123456".

   Lỗi cũ: V006 lưu hash 'fjwEDEYuI54d1+No0j+Dlk3tZV3oC3yh+X/NqmRhe+w=' và CHÚ THÍCH là
   SHA256WithSalt("123456","salt") — nhưng KHÔNG khớp (hash đúng của "123456" là
   '5NL5SaQBwE6c0L1BDjHW+BtBOXQVH8RYwY0tGGw3khk='). Hệ quả: DB seed xong login "123456" báo sai.
   Ngoài ra recruiter@test.com không được migration nào INSERT -> DB mới thiếu luôn Recruiter.

   Script này: cập nhật hash đúng cho 3 user test đang tồn tại + seed bù user nào còn thiếu.
   Idempotent. Chạy ngoài request -> tắt RLS policy trong lúc seed rồi bật lại.
   ============================================================================= */

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
GO

DECLARE @pwd NVARCHAR(256) = N'5NL5SaQBwE6c0L1BDjHW+BtBOXQVH8RYwY0tGGw3khk='; -- SHA256WithSalt("123456","salt")

DECLARE @companyId BIGINT = (SELECT TOP 1 company_id FROM dbo.Company ORDER BY company_id);

IF @companyId IS NULL
    PRINT N'V016: chưa có Company nào -> bỏ qua seed user test.';
ELSE
BEGIN
    -- Cập nhật hash đúng cho các user test đã tồn tại (mọi tenant).
    UPDATE dbo.[User] SET password_hash = @pwd
    WHERE email IN (N'recruiter@test.com', N'interviewer@test.com', N'manager@test.com');

    -- Seed bù user nào còn thiếu (đặc biệt recruiter@test.com chưa từng được INSERT).
    IF NOT EXISTS (SELECT 1 FROM dbo.[User] WHERE company_id = @companyId AND email = N'recruiter@test.com')
        INSERT INTO dbo.[User] (company_id, email, password_hash, role, status)
        VALUES (@companyId, N'recruiter@test.com', @pwd, 'Recruiter', 'Active');

    IF NOT EXISTS (SELECT 1 FROM dbo.[User] WHERE company_id = @companyId AND email = N'interviewer@test.com')
        INSERT INTO dbo.[User] (company_id, email, password_hash, role, status)
        VALUES (@companyId, N'interviewer@test.com', @pwd, 'Interviewer', 'Active');

    IF NOT EXISTS (SELECT 1 FROM dbo.[User] WHERE company_id = @companyId AND email = N'manager@test.com')
        INSERT INTO dbo.[User] (company_id, email, password_hash, role, status)
        VALUES (@companyId, N'manager@test.com', @pwd, 'DepartmentManager', 'Active');

    PRINT N'V016: đã sửa hash + seed bù user test (mật khẩu "123456") cho company_id ' + CAST(@companyId AS NVARCHAR(20)) + N'.';
END
GO

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
GO
