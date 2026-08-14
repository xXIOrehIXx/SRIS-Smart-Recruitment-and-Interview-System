/* =============================================================================
   MIGRATION V039 — TRẢ LẠI CỘT Job.quantity (số lượng cần tuyển của tin).

   V032 xoá cột này với lý do "số lượng cần tuyển nằm ở Yêu cầu tuyển dụng, không
   ở Job". Nhưng phần còn lại của hệ thống không đi theo quyết định đó:

     - Form tin tuyển dụng vẫn có ô "Số Lượng Tuyển", BẮT BUỘC nhập khi đăng tin.
     - Yêu cầu tuyển dụng của trưởng bộ phận điền sẵn số lượng sang form tạo tin.
     - JobCreateDto/JobUpdateDto vẫn [Range(1,999)], JobRepo.UpdateExtendedAsync
       vẫn SetProperty(j => j.Quantity, ...).

   Hệ quả: entity phải mang `e.Ignore(x => x.Quantity)` để EF khỏi tìm cột không
   còn, nên GET job luôn trả quantity = 0, và MỌI lệnh PUT /api/jobs/{id} vỡ:
     - gửi lại nguyên payload vừa GET  -> 400 "Số lượng tuyển phải từ 1 đến 999"
       (0 nằm ngoài Range) — chính là lỗi khi bấm "Mở lại" một tin đã đóng;
     - gửi quantity hợp lệ            -> 500, EF không dịch nổi SetProperty lên
       property đang bị Ignore.
   Tức là sửa tin tuyển dụng hỏng hoàn toàn, không riêng thao tác mở lại.

   Chốt 13/08/2026: giữ số lượng Ở CẢ HAI NƠI — yêu cầu tuyển dụng là đề xuất của
   trưởng bộ phận, tin tuyển dụng là con số thật sự đăng ra (nhân sự có thể sửa).
   Nên trả cột về đúng chỗ code đang chờ, thay vì gỡ ô nhập mà người dùng đang dùng.

   Tin đã có: mặc định 1 (đăng 1 vị trí) — không có dữ liệu cũ để khôi phục vì
   V032 đã xoá hẳn.

   Idempotent: chỉ thêm khi cột chưa tồn tại.
   ============================================================================= */

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Job') AND name = 'quantity'
)
BEGIN
    ALTER TABLE dbo.Job
        ADD quantity INT NOT NULL
            CONSTRAINT DF_Job_quantity DEFAULT 1;

    PRINT 'V039: da them cot Job.quantity (NOT NULL, default 1).';
END
ELSE
BEGIN
    PRINT 'V039: cot Job.quantity da ton tai - bo qua.';
END
GO

/* Ràng buộc giá trị khớp với [Range(1, 999)] ở tầng DTO — hai tầng cùng một luật,
   để dữ liệu bẩn không lọt vào bằng đường khác (seed script, sửa tay). */
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.Job') AND name = 'CK_Job_quantity'
)
BEGIN
    ALTER TABLE dbo.Job
        ADD CONSTRAINT CK_Job_quantity CHECK (quantity BETWEEN 1 AND 999);

    PRINT 'V039: da them CHECK CK_Job_quantity (1..999).';
END
GO
