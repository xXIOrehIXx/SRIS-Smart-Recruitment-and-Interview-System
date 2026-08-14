/* =============================================================================
   MIGRATION V040 — BỎ RecruitmentRequest.priority (mức ưu tiên LOW/MEDIUM/HIGH).

   Cột này chỉ được GHI rồi ĐỌC LẠI, không có gì đọc nó để làm gì:
     - Không màn nào hiển thị, form tạo Yêu cầu tuyển dụng cũng không có ô nhập
       -> mọi yêu cầu thực tế đều nằm ở MEDIUM mặc định.
     - Không sort, không filter, không nhắc hạn, không gác luồng duyệt.
   Tức là "ưu tiên cao" xong thì KHÔNG có gì xảy ra khác với "ưu tiên thấp".
   Chốt 13/08/2026: bỏ, thay vì bày thêm một ô cho người dùng điền vào chỗ trống.

   Muốn làm mức ưu tiên tử tế sau này thì phải kèm hành vi (xếp đầu danh sách chờ
   duyệt, cảnh báo quá hạn...) rồi hãy thêm cột lại.

   Idempotent: gỡ DEFAULT + CHECK bám vào cột trước rồi mới DROP; chạy trên DB đã
   sạch thì không làm gì.
   ============================================================================= */

SET NOCOUNT ON;

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.RecruitmentRequest') AND name = 'priority'
)
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'';

    /* CHECK constraint (CK_RecruitReq_priority ở V019 — tra ngược qua dependency để
       bắt cả bản DB đặt tên khác). */
    SELECT @sql = @sql + N'ALTER TABLE dbo.RecruitmentRequest DROP CONSTRAINT '
                       + QUOTENAME(cc.name) + N';' + CHAR(10)
    FROM sys.check_constraints cc
    JOIN sys.sql_expression_dependencies d
      ON d.referencing_id = cc.object_id
    JOIN sys.columns c
      ON c.object_id = d.referenced_id AND c.column_id = d.referenced_minor_id
    WHERE cc.parent_object_id = OBJECT_ID('dbo.RecruitmentRequest')
      AND c.name = 'priority';

    /* DEFAULT constraint */
    SELECT @sql = @sql + N'ALTER TABLE dbo.RecruitmentRequest DROP CONSTRAINT '
                       + QUOTENAME(dc.name) + N';' + CHAR(10)
    FROM sys.default_constraints dc
    JOIN sys.columns c
      ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.RecruitmentRequest')
      AND c.name = 'priority';

    IF LEN(@sql) > 0 EXEC sp_executesql @sql;

    ALTER TABLE dbo.RecruitmentRequest DROP COLUMN priority;
    PRINT 'V040: da bo cot RecruitmentRequest.priority.';
END
ELSE
BEGIN
    PRINT 'V040: cot priority khong ton tai - bo qua.';
END
