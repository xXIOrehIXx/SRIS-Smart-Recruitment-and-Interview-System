/* =============================================================================
   MIGRATION V013 — CHẤM CV THEO TỪNG TIÊU CHÍ (docs 5.18, Việc B4).
   Tiêu chí là trục xuyên suốt: AI bóc DRAFT -> người duyệt APPROVED -> chấm CV
   per-criterion (khớp/thiếu + bằng chứng) -> cùng bộ tiêu chí chấm phỏng vấn.

   Gồm: (1) mở rộng EvaluationCriteria (phân loại HARD/SOFT, cờ CV_MATCHABLE,
   nguồn gốc + audit duyệt, keywords cho lọc rule, embedding tiêu chí);
   (2) CvChunk — tầng vector TỪNG-ĐOẠN (tầng cả-CV của Talent Pool GIỮ NGUYÊN);
   (3) ApplicationCriterionMatch — kết quả khớp/thiếu + bằng chứng per-criterion;
   (4) Application.criteria_score. Idempotent.
   ============================================================================= */

/* (1) EvaluationCriteria: phân loại + nguồn gốc + duyệt (5.18). */
IF COL_LENGTH('dbo.EvaluationCriteria', 'criteria_type') IS NULL
    ALTER TABLE dbo.EvaluationCriteria
        ADD criteria_type VARCHAR(10) NOT NULL CONSTRAINT DF_Crit_type DEFAULT 'SOFT';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Crit_type')
    ALTER TABLE dbo.EvaluationCriteria
        ADD CONSTRAINT CK_Crit_type CHECK (criteria_type IN ('HARD','SOFT'));
GO
/* CV_MATCHABLE (thấy được trong CV) vs INTERVIEW_ONLY (chỉ đánh giá khi gặp người).
   Chấm CV CHỈ tính nhóm cv_matchable=1 — tránh loại oan vì thứ CV không thể hiện. */
IF COL_LENGTH('dbo.EvaluationCriteria', 'cv_matchable') IS NULL
    ALTER TABLE dbo.EvaluationCriteria
        ADD cv_matchable BIT NOT NULL CONSTRAINT DF_Crit_matchable DEFAULT 1;
GO
/* Nguồn gốc + audit duyệt: AI không quyết tiêu chí — người duyệt (câu chốt bảo vệ). */
IF COL_LENGTH('dbo.EvaluationCriteria', 'source') IS NULL
    ALTER TABLE dbo.EvaluationCriteria
        ADD source VARCHAR(20) NOT NULL CONSTRAINT DF_Crit_source DEFAULT 'MANUAL';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Crit_source')
    ALTER TABLE dbo.EvaluationCriteria
        ADD CONSTRAINT CK_Crit_source CHECK (source IN ('MANUAL','AI_EXTRACTED'));
GO
/* Pattern DRAFT -> duyệt -> APPROVED (như quiz cũ, tái dùng cho tiêu chí).
   Dòng có sẵn (nhập tay từ trước) mặc định APPROVED — không đổi hành vi cũ. */
IF COL_LENGTH('dbo.EvaluationCriteria', 'status') IS NULL
    ALTER TABLE dbo.EvaluationCriteria
        ADD status VARCHAR(10) NOT NULL CONSTRAINT DF_Crit_status DEFAULT 'APPROVED';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Crit_status')
    ALTER TABLE dbo.EvaluationCriteria
        ADD CONSTRAINT CK_Crit_status CHECK (status IN ('DRAFT','APPROVED'));
GO
IF COL_LENGTH('dbo.EvaluationCriteria', 'approved_by') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD approved_by BIGINT NULL;
GO
IF COL_LENGTH('dbo.EvaluationCriteria', 'approved_at') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD approved_at DATETIME2(3) NULL;
GO
/* Keywords cho tiêu chí HARD (lọc rule/keyword — vector so ngữ nghĩa dễ sai với yêu cầu cứng).
   Danh sách phân tách bằng ';' (vd "CPA;chứng chỉ kế toán"). NULL -> dùng name. */
IF COL_LENGTH('dbo.EvaluationCriteria', 'keywords') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD keywords NVARCHAR(500) NULL;
GO
/* Embedding của tiêu chí SOFT (lazy — sinh 1 lần lúc chấm đầu tiên, như JD). */
IF COL_LENGTH('dbo.EvaluationCriteria', 'embedding') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD embedding VECTOR(1024) NULL;
GO

/* (2) CvChunk — tầng vector từng-đoạn. KHÔNG thay tầng cả-CV (CvDocument.embedding
   Talent Pool đang dùng). Quy tắc re-embedding áp cho CẢ HAI tầng. */
IF OBJECT_ID('dbo.CvChunk', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CvChunk (
        chunk_id     BIGINT IDENTITY(1,1) NOT NULL,
        company_id   BIGINT               NOT NULL,
        cv_id        BIGINT               NOT NULL,
        chunk_index  INT                  NOT NULL,
        content      NVARCHAR(MAX)        NOT NULL,
        embedding    VECTOR(1024)         NULL,
        created_at   DATETIME2(3)         NOT NULL CONSTRAINT DF_Chunk_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_CvChunk      PRIMARY KEY (chunk_id),
        CONSTRAINT FK_Chunk_Company FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_Chunk_Cv      FOREIGN KEY (cv_id)      REFERENCES dbo.CvDocument(cv_id)
    );
    CREATE INDEX IX_Chunk_cv ON dbo.CvChunk(company_id, cv_id, chunk_index);
END
GO

/* (3) ApplicationCriterionMatch — kết quả per-criterion: khớp/thiếu + bằng chứng.
   similarity NULL với tiêu chí HARD (lọc rule, không đo cosine). */
IF OBJECT_ID('dbo.ApplicationCriterionMatch', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ApplicationCriterionMatch (
        match_id       BIGINT IDENTITY(1,1) NOT NULL,
        company_id     BIGINT               NOT NULL,
        application_id BIGINT               NOT NULL,
        criteria_id    BIGINT               NOT NULL,
        matched        BIT                  NOT NULL,
        similarity     DECIMAL(6,4)         NULL,
        evidence       NVARCHAR(1000)       NULL,
        evaluated_at   DATETIME2(3)         NOT NULL CONSTRAINT DF_Match_eval DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_AppCritMatch       PRIMARY KEY (match_id),
        CONSTRAINT FK_Match_Company      FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_Match_Application  FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
        CONSTRAINT FK_Match_Criteria     FOREIGN KEY (criteria_id)    REFERENCES dbo.EvaluationCriteria(criteria_id),
        CONSTRAINT UQ_Match_app_criteria UNIQUE (application_id, criteria_id)
    );
    CREATE INDEX IX_Match_app ON dbo.ApplicationCriterionMatch(company_id, application_id);
END
GO

/* (4) Application: điểm theo tiêu chí (tách khỏi ai_match_score cả-CV để so sánh 2 cách). */
IF COL_LENGTH('dbo.Application', 'criteria_score') IS NULL
    ALTER TABLE dbo.Application ADD criteria_score DECIMAL(6,2) NULL;
GO

/* (5) RLS cho 2 bảng mới (3 lớp phòng thủ — 5.2). */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.CvChunk'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.CvChunk,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.CvChunk;
GO
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.ApplicationCriterionMatch'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.ApplicationCriterionMatch,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.ApplicationCriterionMatch;
GO

PRINT N'Migration V013 xong: EvaluationCriteria mở rộng (type/cv_matchable/source/status/keywords/embedding); CvChunk; ApplicationCriterionMatch; Application.criteria_score; RLS.';
GO
