/* =============================================================================
   MIGRATION V017 — SMTP theo từng công ty (per-tenant email, Phase 2).

   Mỗi công ty (tenant) tự khai báo SMTP riêng -> email đi từ tên miền của họ
   (vd hr@sotatek.com). Company entity đã có sẵn các thuộc tính này (trước bị Ignore
   vì DB chưa có cột) — thêm cột vào bảng để bật lên.

   Bỏ trống SMTP của công ty -> hệ thống fallback về SMTP global (appsettings) như cũ.
   Lưu ý bảo mật: smtp_password nên MÃ HÓA at-rest ở production (hiện lưu thẳng — TODO).
   ============================================================================= */

IF COL_LENGTH('dbo.Company', 'email_domain')     IS NULL ALTER TABLE dbo.Company ADD email_domain     NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Company', 'smtp_host')        IS NULL ALTER TABLE dbo.Company ADD smtp_host        NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Company', 'smtp_port')        IS NULL ALTER TABLE dbo.Company ADD smtp_port        INT           NULL;
IF COL_LENGTH('dbo.Company', 'smtp_username')    IS NULL ALTER TABLE dbo.Company ADD smtp_username    NVARCHAR(255) NULL;
IF COL_LENGTH('dbo.Company', 'smtp_password')    IS NULL ALTER TABLE dbo.Company ADD smtp_password    NVARCHAR(512) NULL;
IF COL_LENGTH('dbo.Company', 'smtp_from_email')  IS NULL ALTER TABLE dbo.Company ADD smtp_from_email  NVARCHAR(255) NULL;
GO

PRINT N'V017: đã thêm cột SMTP per-tenant vào dbo.Company.';
GO
