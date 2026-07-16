/* =============================================================================
   MIGRATION V021 — DỌN CHECK constraint cũ trên dbo.Job.

   Lý do: trước V020, DB đã có 1 (hoặc nhiều) CHECK constraint cũ với tên khác
   (ví dụ "CK_Job_emptype") reject các giá trị employment_type mà code đẩy lên
   (như 'Full-time', 'Remote'...). Kết quả: INSERT Job thất bại với 500.
   V020 đã DROP các constraint do V020 tự tạo (CK_Job_employment_type / work_mode /
   experience_level) nhưng KHÔNG đụng vào constraint cũ tên khác.

   Script này quét sys.check_constraints và DROP mọi CK trên cột Job, kèm RLS
   trên các bảng phụ (idempotent). Không phụ thuộc tên cụ thể.

   An toàn: validate dữ liệu là trách nhiệm của backend (RegularExpression trên
   JobCreateDto) + frontend (chỉ cho chọn giá trị hợp lệ). DB chỉ còn giữ type
   VARCHAR để linh hoạt cho các ngôn ngữ giá trị mới thêm sau này.
   ============================================================================= */

DECLARE @sql NVARCHAR(MAX) = N'';

SELECT @sql = @sql + N'ALTER TABLE dbo.Job DROP CONSTRAINT ' + QUOTENAME(name) + N';' + CHAR(10)
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.Job');

IF LEN(@sql) > 0
BEGIN
    PRINT N'Dropping CHECK constraints on dbo.Job:';
    PRINT @sql;
    EXEC sp_executesql @sql;
END
ELSE
    PRINT N'Không có CHECK constraint nào trên dbo.Job (bỏ qua).';
GO

PRINT N'Migration V021 xong: đã dọn mọi CHECK constraint trên dbo.Job.';
GO