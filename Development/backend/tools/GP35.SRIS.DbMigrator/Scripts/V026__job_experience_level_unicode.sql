/* =============================================================================
   MIGRATION V026 — Job.experience_level: VARCHAR(20) -> NVARCHAR(50).

   Cột này là Ô NHẬP TỰ DO ở màn Tạo tin tuyển dụng, người dùng gõ tiếng Việt
   ("2+ năm", "Không yêu cầu"). VARCHAR không giữ được dấu nên dữ liệu bị hỏng
   âm thầm ngay lúc lưu ("2+ nam", "Không yêu c?u") — không có lỗi nào báo ra.
   20 ký tự cũng quá chật cho các mô tả kiểu "2+ năm kinh nghiệm".

   employment_type / work_mode giữ nguyên VARCHAR: chỉ nhận giá trị ASCII cố định
   (Full-time, Internship, Onsite, Hybrid...). Idempotent.
   ============================================================================= */

IF EXISTS (
    SELECT 1
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.Job')
      AND c.name = 'experience_level'
      AND t.name = 'varchar'
)
    ALTER TABLE dbo.Job ALTER COLUMN experience_level NVARCHAR(50) NULL;
GO

PRINT N'Migration V026 xong: Job.experience_level -> NVARCHAR(50).';
GO
