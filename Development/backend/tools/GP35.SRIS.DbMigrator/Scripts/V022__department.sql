/* =============================================================================
   MIGRATION V022 — Phòng ban (Department).

   Trước giờ Job.department / RecruitmentRequest.department là text tự do -> mỗi người
   gõ một kiểu. Tạo bảng Department làm danh mục (Admin quản lý), form Job/Yêu cầu
   tuyển dụng đổi sang dropdown chọn từ danh mục này. Job vẫn lưu TÊN phòng ban
   (NVARCHAR) — không đổi sang FK để khỏi migrate dữ liệu cũ; đổi tên phòng ban thì
   service tự đồng bộ tên trong Job/RecruitmentRequest.

   Backfill: bóc DISTINCT tên phòng ban đang dùng ở Job + RecruitmentRequest thành
   dòng Department để dropdown không trống sau khi nâng cấp. Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.Department', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Department (
        department_id BIGINT IDENTITY(1,1) NOT NULL,
        company_id    BIGINT               NOT NULL,
        name          NVARCHAR(255)        NOT NULL,
        description   NVARCHAR(500)        NULL,
        status        VARCHAR(20)          NOT NULL CONSTRAINT DF_Department_status DEFAULT 'Active',
        created_at    DATETIME2(3)         NOT NULL CONSTRAINT DF_Department_created DEFAULT SYSUTCDATETIME(),
        updated_at    DATETIME2(3)         NULL,
        CONSTRAINT PK_Department PRIMARY KEY (department_id),
        CONSTRAINT FK_Department_Company FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
        CONSTRAINT UQ_Department_company_name UNIQUE (company_id, name),
        CONSTRAINT CK_Department_status CHECK (status IN ('Active','Inactive'))
    );
    CREATE NONCLUSTERED INDEX IX_Department_company ON dbo.Department(company_id);
END
GO

/* RLS: cô lập tenant như mọi bảng có company_id (coding rule #1). Idempotent. */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.Department'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Department,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Department;
GO

/* Backfill chạy ngoài request (không có SESSION_CONTEXT) -> tắt policy rồi bật lại
   (pattern V006/V012 — DbUp bọc transaction, lỗi giữa chừng rollback cả ALTER). */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
GO

INSERT INTO dbo.Department (company_id, name)
SELECT src.company_id, src.name
FROM (
    SELECT company_id, LTRIM(RTRIM(department)) AS name
    FROM dbo.Job
    WHERE department IS NOT NULL AND LTRIM(RTRIM(department)) <> N''
    UNION
    SELECT company_id, LTRIM(RTRIM(department))
    FROM dbo.RecruitmentRequest
    WHERE department IS NOT NULL AND LTRIM(RTRIM(department)) <> N''
) src
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Department d
    WHERE d.company_id = src.company_id AND d.name = src.name
);
GO

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
GO
