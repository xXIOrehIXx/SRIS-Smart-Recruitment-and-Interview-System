/* =============================================================================
   MIGRATION V025 — ảnh đại diện của User (màn Settings -> "Change Photo").
   Lưu OBJECT KEY trong MinIO (vd "avatar/6/12/ab12...jpg"), KHÔNG lưu URL đầy đủ:
   URL xem ảnh là presigned có hạn, sinh lại mỗi lần đọc (giống CvDocument.file_url).
   Idempotent.
   ============================================================================= */

IF COL_LENGTH('dbo.[User]', 'avatar_url') IS NULL
    ALTER TABLE dbo.[User] ADD avatar_url VARCHAR(500) NULL;
GO

PRINT N'Migration V025 xong: User.avatar_url.';
GO
