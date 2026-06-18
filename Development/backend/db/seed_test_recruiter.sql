/* ============================================================
   SEED tài khoản test: 1 Company + 1 user Recruiter.
   Dùng để đăng nhập rồi test API tạo Job + chấm điểm CV.
   ------------------------------------------------------------
   Mật khẩu: 123456
   password_hash = SHA256WithSalt('123456','salt') của EncodeService (Base64).
   ------------------------------------------------------------
   LƯU Ý RLS: [User] và Job có Row-Level Security theo SESSION_CONTEXT('CompanyId').
   PHẢI set context trước khi INSERT, nếu không BLOCK predicate sẽ chặn.
   (Company KHÔNG có RLS nên insert tự do.)
   ============================================================ */

USE SRIS;
GO

-- (1) Company — tạo nếu DB chưa có công ty nào.
IF NOT EXISTS (SELECT 1 FROM dbo.Company)
    INSERT INTO dbo.Company (name, slug, primary_color)
    VALUES (N'Demo Company', 'demo', '#2563eb');
GO

DECLARE @companyId BIGINT = (SELECT MIN(company_id) FROM dbo.Company);

-- (2) Set tenant context — BẮT BUỘC trước khi đụng bảng có RLS.
EXEC sp_set_session_context @key = N'CompanyId', @value = @companyId;

-- (3) Recruiter (đăng nhập: recruiter@test.com / 123456).
IF NOT EXISTS (SELECT 1 FROM dbo.[User] WHERE company_id = @companyId AND email = N'recruiter@test.com')
    INSERT INTO dbo.[User] (company_id, email, password_hash, role, status)
    VALUES (@companyId, N'recruiter@test.com',
            N'fjwEDEYuI54d1+No0j+Dlk3tZV3oC3yh+X/NqmRhe+w=', 'Recruiter', 'Active');

-- (Tùy chọn) 1 Interviewer để test phân quyền: login được nhưng tạo Job -> 403.
IF NOT EXISTS (SELECT 1 FROM dbo.[User] WHERE company_id = @companyId AND email = N'interviewer@test.com')
    INSERT INTO dbo.[User] (company_id, email, password_hash, role, status)
    VALUES (@companyId, N'interviewer@test.com',
            N'fjwEDEYuI54d1+No0j+Dlk3tZV3oC3yh+X/NqmRhe+w=', 'Interviewer', 'Active');

PRINT N'Seed xong. Đăng nhập: recruiter@test.com / 123456 (Recruiter), interviewer@test.com / 123456 (Interviewer).';
SELECT user_id, company_id, email, role FROM dbo.[User] WHERE company_id = @companyId;
GO
