/* =============================================================================
   MIGRATION V048 — Địa điểm làm việc + Hạn nộp đơn trên Yêu cầu tuyển dụng (docs 5.17).

   DM "ra đề" nhưng đề bài thiếu đúng hai thứ mà tin tuyển dụng BẮT BUỘC phải có:
   nơi làm việc và hạn nhận hồ sơ. Hệ quả: Human Resource tạo Job từ yêu cầu thì hai ô
   đó trống trơn, phải quay lại hỏi DM — đúng thứ luồng "ra đề -> đăng tin" định bỏ đi.

   deadline ở đây là HẠN NỘP ĐƠN (khớp Job.deadline), KHÁC expected_start_date là
   NGÀY CẦN NGƯỜI. Một yêu cầu có thể cần người vào 01/10 nhưng chốt nhận hồ sơ 15/09.
   Cả hai đều NULL được: yêu cầu cũ không có, và DM không phải lúc nào cũng biết trước.
   Idempotent.
   ============================================================================= */

IF COL_LENGTH('dbo.RecruitmentRequest', 'location') IS NULL
    ALTER TABLE dbo.RecruitmentRequest ADD location NVARCHAR(255) NULL;
GO

IF COL_LENGTH('dbo.RecruitmentRequest', 'deadline') IS NULL
    ALTER TABLE dbo.RecruitmentRequest ADD deadline DATETIME2(3) NULL;
GO
