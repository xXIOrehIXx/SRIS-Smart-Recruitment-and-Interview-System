/* =============================================================================
   MIGRATION V035 — Quyền lợi mặc định của công ty.

   Quyền lợi hầu như không đổi giữa các tin tuyển dụng (BHXH, thưởng tháng 13,
   du lịch hằng năm) — bắt người tuyển dụng gõ lại cho từng tin là việc thừa.
   Nhập 1 lần ở hồ sơ công ty, mỗi tin MỚI tự điền sẵn, sửa riêng từng tin được.

   Vì sao 1 CỘT TEXT chứ không thêm bảng con như JobBenefit:
     - Dữ liệu là vài dòng thuộc về đúng 1 hàng Company, không cần join/truy vấn
       theo từng dòng, cũng không cần thứ tự riêng ngoài thứ tự người gõ.
     - Company là hàng tenant sẵn có -> khỏi dựng bảng mới kèm RLS policy riêng.
     - Cùng quy ước với RecruitmentRequest.benefits (các dòng ngăn bởi \n).

   Đây là CHÉP MỘT LẦN lúc tạo tin, không phải liên kết sống: sửa cột này KHÔNG
   đổi các tin đã đăng.

   Idempotent.
   ============================================================================= */

IF COL_LENGTH('dbo.Company', 'default_benefits') IS NULL
    ALTER TABLE dbo.Company ADD default_benefits NVARCHAR(MAX) NULL;
GO

PRINT N'Migration V035 xong: Company.default_benefits.';
GO
