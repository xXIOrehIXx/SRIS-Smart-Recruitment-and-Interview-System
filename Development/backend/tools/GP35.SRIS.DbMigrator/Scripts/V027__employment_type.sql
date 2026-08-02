/* =============================================================================
   MIGRATION V027 — Hình thức làm việc (EmploymentType).

   Trước giờ hình thức làm việc là danh sách CỨNG trong code, và tệ hơn: hai form
   dùng hai bộ từ vựng cho cùng một thứ — Tin tuyển dụng lưu 'Full-time', Yêu cầu
   tuyển dụng lưu 'FULL_TIME' — nên phải có bảng quy đổi ở FE, ai quên là ô Select
   hiện trống. Giờ làm danh mục như Department (V022): Admin CRUD, mọi role đọc.

   Quy ước tham chiếu: Job/RecruitmentRequest lưu TÊN hình thức (không FK), giống
   hệt Department — đổi tên trong danh mục thì service tự đồng bộ 2 bảng đó.

   1) Nới kiểu cột: Job.employment_type đang VARCHAR(20) (ASCII) -> NVARCHAR(100),
      nếu không tên tiếng Việt ("Toàn thời gian") vào DB thành dấu hỏi (bài học V026).
   2) Chuẩn hóa dữ liệu cũ của CẢ HAI bảng về cùng một bộ tên tiếng Việt.
   3) Seed danh mục mặc định cho mọi công ty + gom mọi giá trị lạ còn sót lại
      thành dòng danh mục để dropdown không bao giờ trống so với dữ liệu đang có.
   Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.EmploymentType', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.EmploymentType (
        employment_type_id BIGINT IDENTITY(1,1) NOT NULL,
        company_id         BIGINT               NOT NULL,
        name               NVARCHAR(100)        NOT NULL,
        description        NVARCHAR(500)        NULL,
        status             VARCHAR(20)          NOT NULL CONSTRAINT DF_EmploymentType_status DEFAULT 'Active',
        created_at         DATETIME2(3)         NOT NULL CONSTRAINT DF_EmploymentType_created DEFAULT SYSUTCDATETIME(),
        updated_at         DATETIME2(3)         NULL,
        CONSTRAINT PK_EmploymentType PRIMARY KEY (employment_type_id),
        CONSTRAINT FK_EmploymentType_Company FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
        CONSTRAINT UQ_EmploymentType_company_name UNIQUE (company_id, name),
        CONSTRAINT CK_EmploymentType_status CHECK (status IN ('Active','Inactive'))
    );
    CREATE NONCLUSTERED INDEX IX_EmploymentType_company ON dbo.EmploymentType(company_id);
END
GO

/* RLS: cô lập tenant như mọi bảng có company_id (coding rule #1). Idempotent. */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.EmploymentType'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.EmploymentType,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.EmploymentType;
GO

/* (1) Nới kiểu cột để chứa được tên tiếng Việt. */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.Job') AND name = 'employment_type'
             AND system_type_id = TYPE_ID('varchar'))
    ALTER TABLE dbo.Job ALTER COLUMN employment_type NVARCHAR(100) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.RecruitmentRequest') AND name = 'employment_type'
             AND max_length < 200)
    ALTER TABLE dbo.RecruitmentRequest ALTER COLUMN employment_type NVARCHAR(100) NULL;
GO

/* Backfill chạy ngoài request (không có SESSION_CONTEXT) -> tắt policy rồi bật lại
   (pattern V006/V012/V022 — DbUp bọc transaction, lỗi giữa chừng rollback cả ALTER). */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
GO

/* (2) Chuẩn hóa dữ liệu cũ về cùng một bộ tên. Bảng quy đổi này chính là bảng
   EMPLOYMENT_TYPE_TO_JOB ở FE — chuyển một lần xuống DB rồi xóa hẳn khỏi code. */
DECLARE @map TABLE (old_value NVARCHAR(100), new_name NVARCHAR(100));
INSERT INTO @map (old_value, new_name) VALUES
    (N'Full-time',   N'Toàn thời gian'),
    (N'FULL_TIME',   N'Toàn thời gian'),
    (N'Part-time',   N'Bán thời gian'),
    (N'PART_TIME',   N'Bán thời gian'),
    (N'Contract',    N'Hợp đồng'),
    (N'CONTRACT',    N'Hợp đồng'),
    (N'Internship',  N'Thực tập'),
    (N'INTERNSHIP',  N'Thực tập'),
    (N'Remote',      N'Làm việc từ xa'),
    (N'REMOTE',      N'Làm việc từ xa'),
    (N'Freelance',   N'Freelance'),
    (N'FREELANCE',   N'Freelance');

UPDATE j
SET    employment_type = m.new_name
FROM   dbo.Job j
JOIN   @map m ON m.old_value = j.employment_type
WHERE  j.employment_type <> m.new_name;

UPDATE r
SET    employment_type = m.new_name
FROM   dbo.RecruitmentRequest r
JOIN   @map m ON m.old_value = r.employment_type
WHERE  r.employment_type <> m.new_name;
GO

/* (3a) Seed danh mục mặc định cho mọi công ty. */
INSERT INTO dbo.EmploymentType (company_id, name)
SELECT c.company_id, v.name
FROM   dbo.Company c
CROSS JOIN (VALUES
    (N'Toàn thời gian'), (N'Bán thời gian'), (N'Hợp đồng'),
    (N'Thực tập'), (N'Làm việc từ xa')
) v(name)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.EmploymentType e
    WHERE e.company_id = c.company_id AND e.name = v.name
);
GO

/* (3b) Giá trị lạ còn sót (công ty tự gõ trước đây) -> thành dòng danh mục, để dữ liệu
   cũ vẫn hiện đúng trong dropdown thay vì rơi ra ngoài danh sách. */
INSERT INTO dbo.EmploymentType (company_id, name)
SELECT src.company_id, src.name
FROM (
    SELECT company_id, LTRIM(RTRIM(employment_type)) AS name
    FROM   dbo.Job
    WHERE  employment_type IS NOT NULL AND LTRIM(RTRIM(employment_type)) <> N''
    UNION
    SELECT company_id, LTRIM(RTRIM(employment_type))
    FROM   dbo.RecruitmentRequest
    WHERE  employment_type IS NOT NULL AND LTRIM(RTRIM(employment_type)) <> N''
) src
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.EmploymentType e
    WHERE e.company_id = src.company_id AND e.name = src.name
);
GO

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
GO

PRINT N'Migration V027 xong: bảng EmploymentType + RLS, chuẩn hóa Job/RecruitmentRequest.employment_type về tên tiếng Việt.';
