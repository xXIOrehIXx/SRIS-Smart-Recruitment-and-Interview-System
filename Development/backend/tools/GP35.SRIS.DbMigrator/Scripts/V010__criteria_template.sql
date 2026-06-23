/* =============================================================================
   MIGRATION V010 — Thư viện tiêu chí mẫu (Việc 12).
   Khuôn tiêu chí chấm cấp company, dùng lại nhiều job. Recruiter tạo 1 lần (vd "Khung Dev")
   rồi áp vào job -> clone từng dòng thành dbo.EvaluationCriteria của job đó (không tham chiếu).
   Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.CriteriaTemplate', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CriteriaTemplate (
        template_id   BIGINT IDENTITY(1,1) NOT NULL,
        company_id    BIGINT               NOT NULL,
        name          NVARCHAR(200)        NOT NULL,
        description   NVARCHAR(1000)       NULL,
        active        BIT                  NOT NULL CONSTRAINT DF_CTmpl_active  DEFAULT 1,
        created_at    DATETIME2(3)         NOT NULL CONSTRAINT DF_CTmpl_created DEFAULT SYSUTCDATETIME(),
        updated_at    DATETIME2(3)         NULL,
        CONSTRAINT PK_CriteriaTemplate  PRIMARY KEY (template_id),
        CONSTRAINT FK_CTmpl_Company     FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id)
    );
END
GO

IF OBJECT_ID('dbo.CriteriaTemplateItem', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CriteriaTemplateItem (
        item_id       BIGINT IDENTITY(1,1) NOT NULL,
        company_id    BIGINT               NOT NULL,
        template_id   BIGINT               NOT NULL,
        name          NVARCHAR(200)        NOT NULL,
        weight        DECIMAL(9,2)         NOT NULL CONSTRAINT DF_CTItem_weight DEFAULT 1,
        max_score     DECIMAL(9,2)         NOT NULL CONSTRAINT DF_CTItem_max    DEFAULT 10,
        display_order INT                  NOT NULL CONSTRAINT DF_CTItem_order  DEFAULT 0,
        created_at    DATETIME2(3)         NOT NULL CONSTRAINT DF_CTItem_created DEFAULT SYSUTCDATETIME(),
        updated_at    DATETIME2(3)         NULL,
        CONSTRAINT PK_CriteriaTemplateItem PRIMARY KEY (item_id),
        CONSTRAINT FK_CTItem_Company       FOREIGN KEY (company_id)  REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_CTItem_Template      FOREIGN KEY (template_id) REFERENCES dbo.CriteriaTemplate(template_id)
    );
END
GO

/* Liệt kê item theo template (đã lọc tenant). */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CTItem_template' AND object_id = OBJECT_ID('dbo.CriteriaTemplateItem'))
    CREATE INDEX IX_CTItem_template ON dbo.CriteriaTemplateItem(company_id, template_id, display_order);
GO

PRINT N'Migration V010 xong: CriteriaTemplate + CriteriaTemplateItem + index.';
GO
