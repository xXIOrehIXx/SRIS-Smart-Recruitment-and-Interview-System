/* =============================================================================
   MIGRATION — bổ sung cho tính năng CV scoring + lưu file CV gốc (MinIO).
   Chạy MỘT LẦN trên DB local (đã chạy schema.sql trước đó).
   An toàn chạy lại (idempotent). DDL không bị RLS chặn nên không cần session context.
   ============================================================================= */

/* (1) CvDocument: thêm các cột metadata file để lưu CV gốc trên MinIO.
   - file_url  : object key trong bucket MinIO (vd 'cv/1/12/abc.pdf')
   - file_name : tên file gốc người dùng upload
   - file_size : kích thước (bytes)
   - mime_type : kiểu nội dung (application/pdf) */
IF COL_LENGTH('dbo.CvDocument', 'file_url') IS NULL
    ALTER TABLE dbo.CvDocument ADD file_url NVARCHAR(1000) NULL;
GO
IF COL_LENGTH('dbo.CvDocument', 'file_name') IS NULL
    ALTER TABLE dbo.CvDocument ADD file_name NVARCHAR(600) NULL;
GO
IF COL_LENGTH('dbo.CvDocument', 'file_size') IS NULL
    ALTER TABLE dbo.CvDocument ADD file_size INT NULL;
GO
IF COL_LENGTH('dbo.CvDocument', 'mime_type') IS NULL
    ALTER TABLE dbo.CvDocument ADD mime_type VARCHAR(100) NULL;
GO

/* (2) Nới CHECK parse_status để hỗ trợ trạng thái 'NEEDS_MANUAL_EDIT'
   (PDF scan ảnh không bóc được text -> HR nhập tay, không phải reject). */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Cv_parse_status')
    ALTER TABLE dbo.CvDocument DROP CONSTRAINT CK_Cv_parse_status;
GO
ALTER TABLE dbo.CvDocument
    ADD CONSTRAINT CK_Cv_parse_status
    CHECK (parse_status IN ('OK', 'FAILED', 'NEEDS_MANUAL_EDIT'));
GO

PRINT N'Migration CV scoring xong: CvDocument có file_url/file_name/file_size/mime_type, parse_status nhận thêm NEEDS_MANUAL_EDIT.';
GO
