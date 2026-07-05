/* =============================================================================
   MIGRATION V011 — Đổi chiều embedding 384 -> 1024.
   Đổi model embedding từ `paraphrase-multilingual-MiniLM-L12-v2` (384 chiều, đọc ~512 token,
   cắt cụt CV dài / CV tiếng Việt) sang `BAAI/bge-m3` (1024 chiều, đọc tới 8192 token -> embed
   trọn cả CV 2 trang). Nâng cột `embedding` của Job + CvDocument: VECTOR(384) -> VECTOR(1024).

   Vector 384 cũ KHÔNG tương thích 1024 (2 model khác nhau không so sánh được) -> bỏ hết về NULL;
   hệ thống tự sinh lại bằng bge-m3 ở lần chấm CV/JD đầu (theo cơ chế hiện có — xem JobRepo /
   CvDocumentRepo: nếu embedding NULL thì gọi AI service sinh lại).

   Cách làm (SQL Server 2025): KHÔNG thể ALTER trực tiếp chiều của cột VECTOR khi đang có data,
   nên DROP cột rồi ADD lại với VECTOR(1024) (đồng thời reset toàn bộ về NULL). Vector index trên
   cột (nếu có) phải bỏ trước khi DROP COLUMN.

   AN TOÀN / IDEMPOTENT: chỉ tái tạo cột khi chiều hiện tại KHÁC 1024 — nên chạy lại nhiều lần
   KHÔNG xóa mất vector 1024 đã sinh lại. max_length mục tiêu được dò ĐỘNG qua bảng tạm VECTOR(1024)
   (không hard-code công thức lưu trữ của type).
   ============================================================================= */

/* ---------- Job.embedding ---------- */
IF COL_LENGTH('dbo.Job', 'embedding') IS NULL
BEGIN
    -- DB lạ thiếu cột -> thêm thẳng VECTOR(1024).
    ALTER TABLE dbo.Job ADD embedding VECTOR(1024) NULL;
    PRINT N'V011: Job.embedding chua co -> da them VECTOR(1024).';
END
ELSE
BEGIN
    DECLARE @target_job INT, @cur_job INT;

    -- Dò max_length của VECTOR(1024) tại runtime (độc lập phiên bản SQL Server).
    CREATE TABLE #vprobe_job (v VECTOR(1024) NULL);
    SELECT @target_job = max_length FROM tempdb.sys.columns
        WHERE object_id = OBJECT_ID('tempdb..#vprobe_job') AND name = 'v';
    DROP TABLE #vprobe_job;

    SELECT @cur_job = max_length FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.Job') AND name = 'embedding';

    IF (@cur_job <> @target_job)
    BEGIN
        -- Vector index (nếu ai đó đã bật) phải bỏ trước khi DROP COLUMN.
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'VX_Job_embedding' AND object_id = OBJECT_ID('dbo.Job'))
            DROP INDEX VX_Job_embedding ON dbo.Job;

        ALTER TABLE dbo.Job DROP COLUMN embedding;
        ALTER TABLE dbo.Job ADD embedding VECTOR(1024) NULL;   -- toàn bộ về NULL -> sinh lại bằng bge-m3
        PRINT N'V011: Job.embedding -> VECTOR(1024) (da reset toan bo ve NULL).';
    END
    ELSE
        PRINT N'V011: Job.embedding da la VECTOR(1024) - bo qua.';
END
GO

/* ---------- CvDocument.embedding ---------- */
IF COL_LENGTH('dbo.CvDocument', 'embedding') IS NULL
BEGIN
    ALTER TABLE dbo.CvDocument ADD embedding VECTOR(1024) NULL;
    PRINT N'V011: CvDocument.embedding chua co -> da them VECTOR(1024).';
END
ELSE
BEGIN
    DECLARE @target_cv INT, @cur_cv INT;

    CREATE TABLE #vprobe_cv (v VECTOR(1024) NULL);
    SELECT @target_cv = max_length FROM tempdb.sys.columns
        WHERE object_id = OBJECT_ID('tempdb..#vprobe_cv') AND name = 'v';
    DROP TABLE #vprobe_cv;

    SELECT @cur_cv = max_length FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.CvDocument') AND name = 'embedding';

    IF (@cur_cv <> @target_cv)
    BEGIN
        IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'VX_Cv_embedding' AND object_id = OBJECT_ID('dbo.CvDocument'))
            DROP INDEX VX_Cv_embedding ON dbo.CvDocument;

        ALTER TABLE dbo.CvDocument DROP COLUMN embedding;
        ALTER TABLE dbo.CvDocument ADD embedding VECTOR(1024) NULL;   -- toàn bộ về NULL -> sinh lại bằng bge-m3
        PRINT N'V011: CvDocument.embedding -> VECTOR(1024) (da reset toan bo ve NULL).';
    END
    ELSE
        PRINT N'V011: CvDocument.embedding da la VECTOR(1024) - bo qua.';
END
GO

PRINT N'Migration V011 xong: embedding Job + CvDocument -> VECTOR(1024) (model BAAI/bge-m3).';
GO
