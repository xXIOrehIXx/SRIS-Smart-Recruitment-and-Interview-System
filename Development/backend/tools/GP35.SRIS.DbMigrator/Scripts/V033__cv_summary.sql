/* =============================================================================
   MIGRATION V033 — tóm tắt CV do AI sinh (cache).

   Người tuyển dụng mở hồ sơ là phải tải PDF về đọc mới biết ứng viên có gì.
   Tóm tắt vài gạch đầu dòng ngay trong tab CV cắt được bước đó.

   Vì sao LƯU chứ không gọi AI mỗi lần mở trang: LLM chạy local (Ollama) mất vài
   giây một lượt. Sinh 1 lần, lưu lại, mở sau đọc từ DB.

   KHÔNG liên quan tới chấm điểm CV (đã bỏ hẳn ở V030): cột này chứa văn xuôi mô tả
   nội dung CV, không có điểm số, không so với JD, không dùng để xếp hạng ai.

   Idempotent.
   ============================================================================= */

IF COL_LENGTH('dbo.CvDocument', 'summary') IS NULL
    ALTER TABLE dbo.CvDocument ADD summary NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.CvDocument', 'summary_at') IS NULL
    ALTER TABLE dbo.CvDocument ADD summary_at DATETIME2(3) NULL;
GO

PRINT N'Migration V033 xong: CvDocument.summary/summary_at.';
GO
