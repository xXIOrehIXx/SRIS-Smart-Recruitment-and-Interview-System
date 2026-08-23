/* =============================================================================
   MIGRATION V050 — Bỏ font-weight:800 khỏi các mẫu email đã lưu.

   TRIỆU CHỨNG
   -----------
   Ứng viên nhận thư mời nhận việc, tiêu đề "THƯ MỜI NHẬN VIỆC" hiện ra với đúng bốn chữ
   Ư, Ờ, Ậ, Ệ nhỏ và mảnh hơn hẳn phần còn lại. Không phải lỗi bảng mã: dữ liệu trong DB
   là Unicode đúng, chỉ riêng lúc VẼ ra màn hình mới hỏng.

   NGUYÊN NHÂN
   -----------
   Tiêu đề đặt font-weight:800. Ở mức 800 mail client không dùng Arial Bold nữa mà chọn
   ARIAL BLACK, và Arial Black KHÔNG có các chữ cái riêng của tiếng Việt:

       Ư U+01AF · Ơ U+01A0 · Ờ U+1EDC · Ậ U+1EAC · Ệ U+1EC6 ...

   Thiếu glyph thì client mượn tạm Arial thường cho đúng mấy chữ đó — nên chúng lọt thỏm
   giữa các chữ Arial Black. (Â U+00C2 và Ê U+00CA thì Arial Black CÓ, vì thế "NHẬN" và
   "VIỆC" chỉ hỏng ở Ậ/Ệ chứ không hỏng cả từ — đúng như người dùng mô tả.)
   Arial Bold (font-weight:bold = 700) có đủ bộ, nên chỉ cần hạ weight là hết.

   PHẠM VI
   -------
   Mẫu dựng sẵn trong code đã sửa (EmailTemplateDefaults, OfferLetterEmailBuilder), nhưng
   mẫu của các công ty ĐÃ tạo thì nằm trong bảng EmailTemplate — sửa code không đụng tới.
   Script này vá đúng chuỗi 'font-weight:800' trong body, không đổi gì khác: body là nội
   dung người tuyển dụng tự soạn, không được phép ghi đè cả cục.

   Chạy dưới CompanyId = -1 (sentinel hệ thống của V049) vì RLS lọc theo tenant — không đặt
   session context thì UPDATE này im lặng sửa 0 dòng. Idempotent: chạy lại không còn gì để sửa.
   ============================================================================= */

EXEC sp_set_session_context @key = N'CompanyId', @value = -1;
GO

DECLARE @fixed INT = 0;

UPDATE dbo.EmailTemplate
SET    body = REPLACE(body, N'font-weight:800', N'font-weight:bold'),
       updated_at = SYSUTCDATETIME()
WHERE  body LIKE N'%font-weight:800%';
SET @fixed = @@ROWCOUNT;

/* Biến thể có khoảng trắng — ô soạn thảo giàu định dạng ở FE hay chuẩn hoá lại CSS inline
   thành "font-weight: 800" khi người dùng bấm lưu. */
UPDATE dbo.EmailTemplate
SET    body = REPLACE(body, N'font-weight: 800', N'font-weight: bold'),
       updated_at = SYSUTCDATETIME()
WHERE  body LIKE N'%font-weight: 800%';
SET @fixed = @fixed + @@ROWCOUNT;

PRINT N'V050: da sua font-weight:800 trong ' + CAST(@fixed AS NVARCHAR(10)) + N' mau email.';
GO

EXEC sp_set_session_context @key = N'CompanyId', @value = NULL;
GO
