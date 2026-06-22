/* =============================================================================
   MIGRATION V006 — seed user test cho 2 role còn thiếu: Interviewer + DepartmentManager.
   Để test role gating đủ 3 vai (Recruiter đã có sẵn recruiter@test.com).

   Mật khẩu cả 2: 123456  (hash = SHA256WithSalt("123456","salt"), khớp AuthService).
     - interviewer@test.com  -> Interviewer
     - manager@test.com      -> DepartmentManager

   [User] bị RLS BLOCK theo SESSION_CONTEXT('CompanyId'). Seed chạy ngoài request (không có
   session context) nên TẮT security policy trong lúc seed rồi BẬT lại. DbUp bọc script trong
   transaction -> lỗi giữa chừng sẽ rollback cả ALTER (policy về ON). Idempotent.
   ============================================================================= */

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
GO

DECLARE @pwd NVARCHAR(256) = N'fjwEDEYuI54d1+No0j+Dlk3tZV3oC3yh+X/NqmRhe+w='; -- 123456

-- Cùng tenant với Recruiter sẵn có; DB mới chưa có thì lấy company đầu tiên.
DECLARE @companyId BIGINT =
    COALESCE(
        (SELECT TOP 1 company_id FROM dbo.[User] WHERE email = N'recruiter@test.com' ORDER BY user_id),
        (SELECT TOP 1 company_id FROM dbo.Company ORDER BY company_id)
    );

IF @companyId IS NULL
    PRINT N'V006: chưa có Company/Recruiter nào -> bỏ qua seed user test.';
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.[User] WHERE company_id = @companyId AND email = N'interviewer@test.com')
        INSERT INTO dbo.[User] (company_id, email, password_hash, role, status)
        VALUES (@companyId, N'interviewer@test.com', @pwd, 'Interviewer', 'Active');

    IF NOT EXISTS (SELECT 1 FROM dbo.[User] WHERE company_id = @companyId AND email = N'manager@test.com')
        INSERT INTO dbo.[User] (company_id, email, password_hash, role, status)
        VALUES (@companyId, N'manager@test.com', @pwd, 'DepartmentManager', 'Active');

    PRINT N'V006: seed interviewer@test.com (Interviewer) + manager@test.com (DepartmentManager) cho company_id ' + CAST(@companyId AS NVARCHAR(20)) + N'.';
END
GO

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
GO
