/* =============================================================================
   MIGRATION V034 — BỎ TÓM TẮT CV BẰNG AI (thêm ở V033, bỏ ngay sau đó).

   Lý do bỏ: đo trên CV thật cho thấy chất lượng không đủ tin cậy. Nguồn lỗi nằm ở
   khâu bóc text — PdfTextExtractor cố ý vứt thứ tự chữ (giả định cũ: người tiêu thụ
   là embedding, vốn không nhạy thứ tự), nên CV 2 cột ra text cài răng lược và LLM
   đọc tiêu đề mục thành tên công ty. Sửa gốc là việc riêng, không gánh theo tính
   năng này. AI của hệ thống quay lại đúng MỘT việc: bóc tiêu chí từ JD.

   Không giữ cột lại "cho rẻ": V032 vừa dọn 19 cột chết vì mỗi cột lệch giữa DB dùng
   chung và DB dựng mới phải trả giá bằng một dòng Ignore() trong SrisDbContext.
   Thêm cột chết mới ngay sau đó là đi ngược lại chính việc vừa làm.

   Idempotent: chỉ xoá cột đang tồn tại.
   ============================================================================= */

IF COL_LENGTH('dbo.CvDocument', 'summary') IS NOT NULL
    ALTER TABLE dbo.CvDocument DROP COLUMN summary;
GO

IF COL_LENGTH('dbo.CvDocument', 'summary_at') IS NOT NULL
    ALTER TABLE dbo.CvDocument DROP COLUMN summary_at;
GO

PRINT N'Migration V034 xong: bỏ CvDocument.summary/summary_at.';
GO
