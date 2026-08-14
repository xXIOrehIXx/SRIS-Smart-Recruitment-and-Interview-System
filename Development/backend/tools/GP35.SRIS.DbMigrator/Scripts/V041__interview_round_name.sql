/* =============================================================================
   MIGRATION V041 — Đặt TÊN cho vòng phỏng vấn (InterviewSlotPool.name).

   Vì sao: mọi ATS thật (Greenhouse "Interview Plan", Lever/Ashby/Workable
   "stages") đều cho nhà tuyển dụng đặt TÊN cho từng bước phỏng vấn — "Sơ loại
   qua điện thoại", "Phỏng vấn chuyên môn", "Gặp giám đốc" — và số thứ tự chỉ là
   hệ quả của việc xếp các bước đó. Không nơi nào bắt người dùng GÕ số vòng.

   Hệ thống này trước đó chỉ có round_number: người dùng phải tự hiểu "Vòng 3"
   nghĩa là gì, và vì được chọn tự do nên mở được "Vòng 5" khi mới có vòng 1.
   Từ V041: số vòng do hệ thống tự đánh (tăng dần theo vị trí), người dùng chỉ
   đặt tên. Tên là TÙY CHỌN — bỏ trống thì UI vẫn hiện "Vòng N" như cũ, đúng
   nguyên tắc "đơn giản là mặc định, phức tạp là tùy chọn".

   Idempotent: chạy lại trên DB đã có cột thì không làm gì.
   ============================================================================= */

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.InterviewSlotPool') AND name = 'name'
)
BEGIN
    ALTER TABLE dbo.InterviewSlotPool ADD [name] NVARCHAR(120) NULL;
    PRINT 'V041: da them cot InterviewSlotPool.name.';
END
ELSE
BEGIN
    PRINT 'V041: cot InterviewSlotPool.name da ton tai - bo qua.';
END
GO

/* Lịch chốt tay (pool CLOSED 1 khung do ManualConfirmAsync sinh ra) đặt tên sẵn
   để card trên UI tự giải thích, khỏi phải suy từ status 'CLOSED'. Chỉ vá dữ
   liệu cũ — bản ghi mới đã được service ghi tên ngay lúc tạo. */
UPDATE dbo.InterviewSlotPool
SET [name] = N'Chốt lịch tay'
WHERE [name] IS NULL AND status = 'CLOSED';
GO
