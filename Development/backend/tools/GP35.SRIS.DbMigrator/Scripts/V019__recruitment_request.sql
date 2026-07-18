/* =============================================================================
   MIGRATION V019 — Yêu cầu tuyển dụng (docs 5.17).

   DM "ra đề": tạo Yêu cầu tuyển dụng (TÙY CHỌN — đường tắt của công ty nhỏ là Recruiter
   tự tạo Job). Recruiter duyệt (APPROVED/REJECTED + note) rồi tạo Job từ yêu cầu
   -> status CONVERTED + job_id trỏ về Job đã tạo (truy vết "job này từ đề bài nào").

   Trạng thái: PENDING -> APPROVED -> CONVERTED
                        -> REJECTED
               PENDING -> CANCELLED (DM tự hủy khi còn PENDING)
   Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.RecruitmentRequest', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RecruitmentRequest (
        request_id           BIGINT IDENTITY(1,1) NOT NULL,
        company_id           BIGINT               NOT NULL,
        title                NVARCHAR(255)        NOT NULL,
        department           NVARCHAR(255)        NULL,
        quantity             INT                  NOT NULL CONSTRAINT DF_RecruitReq_qty DEFAULT 1,
        employment_type      NVARCHAR(50)         NULL,
        experience_level     NVARCHAR(50)         NULL,
        priority             VARCHAR(10)          NOT NULL CONSTRAINT DF_RecruitReq_priority DEFAULT 'MEDIUM',
        description          NVARCHAR(MAX)        NULL,
        requirements         NVARCHAR(MAX)        NULL,
        benefits             NVARCHAR(MAX)        NULL,
        salary_min           DECIMAL(18,2)        NULL,
        salary_max           DECIMAL(18,2)        NULL,
        expected_start_date  DATETIME2(3)         NULL,
        status               VARCHAR(20)          NOT NULL CONSTRAINT DF_RecruitReq_status DEFAULT 'PENDING',
        review_note          NVARCHAR(MAX)        NULL,
        reviewed_by          BIGINT               NULL,
        reviewed_at          DATETIME2(3)         NULL,
        job_id               BIGINT               NULL,  -- Job đã tạo từ yêu cầu (khi CONVERTED)
        created_by           BIGINT               NULL,  -- DM ra đề
        created_at           DATETIME2(3)         NOT NULL CONSTRAINT DF_RecruitReq_created DEFAULT SYSUTCDATETIME(),
        updated_at           DATETIME2(3)         NULL,
        CONSTRAINT PK_RecruitmentRequest PRIMARY KEY (request_id),
        CONSTRAINT FK_RecruitReq_Company    FOREIGN KEY (company_id)  REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_RecruitReq_Job        FOREIGN KEY (job_id)      REFERENCES dbo.Job(job_id),
        CONSTRAINT FK_RecruitReq_CreatedBy  FOREIGN KEY (created_by)  REFERENCES dbo.[User](user_id),
        CONSTRAINT FK_RecruitReq_ReviewedBy FOREIGN KEY (reviewed_by) REFERENCES dbo.[User](user_id),
        CONSTRAINT CK_RecruitReq_status   CHECK (status IN ('PENDING','APPROVED','REJECTED','CONVERTED','CANCELLED')),
        CONSTRAINT CK_RecruitReq_priority CHECK (priority IN ('LOW','MEDIUM','HIGH'))
    );
    CREATE NONCLUSTERED INDEX IX_RecruitReq_company ON dbo.RecruitmentRequest(company_id);
    CREATE NONCLUSTERED INDEX IX_RecruitReq_status  ON dbo.RecruitmentRequest(company_id, status);
END
GO

/* RLS: cô lập tenant như mọi bảng có company_id (coding rule #1). Idempotent. */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.RecruitmentRequest'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.RecruitmentRequest,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.RecruitmentRequest;
GO
