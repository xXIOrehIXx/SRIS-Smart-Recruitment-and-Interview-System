/* =============================================================================
   MIGRATION V020 — Mở rộng bảng Job + 2 bảng con JobRequirement / JobBenefit.

   Lý do: Backend JobService.CreateAsync/UpdateAsync hiện chỉ lưu 4 cột (title,
   jd_text, department_manager_id, status). Mọi field khác (department, location,
   employment_type, work_mode, salary_*, currency, expires_at, requirements[],
   benefits[]) bị bỏ -> ứng viên xem Career Site không thấy mô tả đầy đủ.

   Migration này:
   1) Thêm flat columns vào dbo.Job: department, location, employment_type,
      work_mode, salary_min, salary_max, currency, experience_level, deadline,
      benefits_summary (NVARCHAR ngắn cho public card), skill_tags (NVARCHAR csv).
   2) Tạo bảng con dbo.JobRequirement (1-N) và dbo.JobBenefit (1-N).
   3) Cô lập tenant theo RLS cho 2 bảng mới.
   ============================================================================= */

/* ---------- 1) Flat columns trên Job ---------- */
IF COL_LENGTH('dbo.Job', 'department') IS NULL
    ALTER TABLE dbo.Job ADD department NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.Job', 'location') IS NULL
    ALTER TABLE dbo.Job ADD location NVARCHAR(200) NULL;
GO

IF COL_LENGTH('dbo.Job', 'employment_type') IS NULL
    ALTER TABLE dbo.Job ADD employment_type VARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.Job', 'work_mode') IS NULL
    ALTER TABLE dbo.Job ADD work_mode VARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.Job', 'salary_min') IS NULL
    ALTER TABLE dbo.Job ADD salary_min DECIMAL(18,2) NULL;
GO

IF COL_LENGTH('dbo.Job', 'salary_max') IS NULL
    ALTER TABLE dbo.Job ADD salary_max DECIMAL(18,2) NULL;
GO

IF COL_LENGTH('dbo.Job', 'currency') IS NULL
    ALTER TABLE dbo.Job ADD currency CHAR(3) NULL CONSTRAINT DF_Job_currency DEFAULT 'VND';
GO

IF COL_LENGTH('dbo.Job', 'experience_level') IS NULL
    ALTER TABLE dbo.Job ADD experience_level VARCHAR(20) NULL;
GO

IF COL_LENGTH('dbo.Job', 'deadline') IS NULL
    ALTER TABLE dbo.Job ADD deadline DATE NULL;
GO

-- skills lưu dạng CSV ngắn ("React,Node,TypeScript") cho public card; details -> JobBenefit/Requirement.
IF COL_LENGTH('dbo.Job', 'skill_tags') IS NULL
    ALTER TABLE dbo.Job ADD skill_tags NVARCHAR(500) NULL;
GO

-- CHECK constraint cho employment_type / work_mode / experience_level đã bỏ (idempotent).
-- Trước đây check cứng các giá trị nhưng giờ ưu tiên validate ở frontend + service để tránh 500 khi
-- user nhập giá trị mới. Ràng buộc giá trị hợp lệ sẽ được đưa vào FK reference sau nếu cần.
IF OBJECT_ID('dbo.CK_Job_employment_type', 'C') IS NOT NULL
    ALTER TABLE dbo.Job DROP CONSTRAINT CK_Job_employment_type;
GO

IF OBJECT_ID('dbo.CK_Job_work_mode', 'C') IS NOT NULL
    ALTER TABLE dbo.Job DROP CONSTRAINT CK_Job_work_mode;
GO

IF OBJECT_ID('dbo.CK_Job_experience_level', 'C') IS NOT NULL
    ALTER TABLE dbo.Job DROP CONSTRAINT CK_Job_experience_level;
GO

/* ---------- 2) Bảng JobRequirement (1 job -> nhiều yêu cầu, có thứ tự) ---------- */
IF OBJECT_ID('dbo.JobRequirement', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.JobRequirement (
        requirement_id  BIGINT IDENTITY(1,1) NOT NULL,
        company_id      BIGINT               NOT NULL,
        job_id          BIGINT               NOT NULL,
        ordinal         INT                  NOT NULL,         -- thứ tự hiển thị 1..N
        content         NVARCHAR(500)        NOT NULL,
        created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_JR_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_JobRequirement PRIMARY KEY (requirement_id),
        CONSTRAINT FK_JR_Company FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_JR_Job     FOREIGN KEY (job_id)     REFERENCES dbo.Job(job_id),
        CONSTRAINT UQ_JR_job_ord UNIQUE (job_id, ordinal)
    );
    CREATE NONCLUSTERED INDEX IX_JR_company ON dbo.JobRequirement(company_id);
    CREATE NONCLUSTERED INDEX IX_JR_job     ON dbo.JobRequirement(job_id);
END
GO

/* ---------- 3) Bảng JobBenefit (1 job -> nhiều quyền lợi, có thứ tự) ---------- */
IF OBJECT_ID('dbo.JobBenefit', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.JobBenefit (
        benefit_id      BIGINT IDENTITY(1,1) NOT NULL,
        company_id      BIGINT               NOT NULL,
        job_id          BIGINT               NOT NULL,
        ordinal         INT                  NOT NULL,
        content         NVARCHAR(500)        NOT NULL,
        created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_JB_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_JobBenefit PRIMARY KEY (benefit_id),
        CONSTRAINT FK_JB_Company FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_JB_Job     FOREIGN KEY (job_id)     REFERENCES dbo.Job(job_id),
        CONSTRAINT UQ_JB_job_ord UNIQUE (job_id, ordinal)
    );
    CREATE NONCLUSTERED INDEX IX_JB_company ON dbo.JobBenefit(company_id);
    CREATE NONCLUSTERED INDEX IX_JB_job     ON dbo.JobBenefit(job_id);
END
GO

/* ---------- 4) RLS cho 2 bảng mới (coding rule #1) ---------- */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.JobRequirement'))
        ALTER SECURITY POLICY dbo.TenantSecurityPolicy
            ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.JobRequirement,
            ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.JobRequirement;

    IF NOT EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.JobBenefit'))
        ALTER SECURITY POLICY dbo.TenantSecurityPolicy
            ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.JobBenefit,
            ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.JobBenefit;
END
GO

PRINT N'Migration V020 xong: Job.{department,location,employment_type,work_mode,salary_*,currency,experience_level,deadline,skill_tags} + JobRequirement + JobBenefit + RLS.';
GO
