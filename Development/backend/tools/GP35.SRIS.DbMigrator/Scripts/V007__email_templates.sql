/* =============================================================================
   MIGRATION V007 — Email Template động (M4). Bổ sung cột cho EmailTemplate mà entity
   .NET đã có nhưng schema V001 chưa có, để Recruiter/Admin CRUD template theo từng loại
   email (trigger theo state machine + magic link). Idempotent.

   NotificationService tra template active theo (company_id, type), render placeholder
   ({{candidateName}}, {{jobTitle}}, {{link}}, {{expiresAt}}); không có template -> dùng
   nội dung mặc định dựng sẵn trong code (fallback).
   ============================================================================= */

/* name: tên gợi nhớ cho Recruiter (vd "Mời làm quiz - bản tiếng Việt"). */
IF COL_LENGTH('dbo.EmailTemplate', 'name') IS NULL
    ALTER TABLE dbo.EmailTemplate ADD name NVARCHAR(150) NULL;
GO

/* is_active: template đang dùng cho loại đó (mỗi loại nên có 1 active). Mặc định bật. */
IF COL_LENGTH('dbo.EmailTemplate', 'is_active') IS NULL
    ALTER TABLE dbo.EmailTemplate ADD is_active BIT NOT NULL CONSTRAINT DF_Tmpl_active DEFAULT 1;
GO

/* Tra nhanh template active theo loại trong 1 tenant. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tmpl_company_type' AND object_id = OBJECT_ID('dbo.EmailTemplate'))
    CREATE INDEX IX_Tmpl_company_type ON dbo.EmailTemplate(company_id, type, is_active);
GO

PRINT N'Migration V007 xong: EmailTemplate.name/is_active + index.';
GO
