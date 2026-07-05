/* =============================================================================
   MIGRATION V014 — bổ sung hồ sơ User (Admin quản lý tài khoản nội bộ).
   Entity .NET đã khai FullName/Phone/LastLoginAt nhưng schema V001 rút gọn chưa có.
   Idempotent.
   ============================================================================= */

IF COL_LENGTH('dbo.[User]', 'full_name') IS NULL
    ALTER TABLE dbo.[User] ADD full_name NVARCHAR(150) NULL;
GO
IF COL_LENGTH('dbo.[User]', 'phone') IS NULL
    ALTER TABLE dbo.[User] ADD phone VARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.[User]', 'last_login_at') IS NULL
    ALTER TABLE dbo.[User] ADD last_login_at DATETIME2(3) NULL;
GO

PRINT N'Migration V014 xong: User.full_name/phone/last_login_at.';
GO
