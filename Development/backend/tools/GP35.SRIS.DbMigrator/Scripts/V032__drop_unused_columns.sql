/* =============================================================================
   MIGRATION V032 — DỌN 19 CỘT KHÔNG DÙNG (chốt 08/08/2026).

   Đây là di sản của schema thời trước khi có chuỗi migration: DB dùng chung mang
   19 cột mà DB dựng mới từ migration KHÔNG có. Hệ quả là hai môi trường lệch nhau,
   và mỗi cột lệch đó phải trả giá bằng một dòng `e.Ignore(...)` trong SrisDbContext
   để EF đừng đi tìm cột không tồn tại ở máy khác.

   16/19 cột đang được Ignore() tường minh -> tầng code không đọc/ghi chúng.
   3 cột còn lại thuộc EmailLog — bảng này KHÔNG có DbSet, không repo, không service
   nào chạm tới, nên entity EmailLog hiện là entity chết; xoá cột cũng không ảnh hưởng.
   (Nếu sau này ai nối EmailLog vào EF, phải viết migration tạo lại cột cho tử tế.)

   Idempotent: chỉ xoá cột đang tồn tại; chạy trên DB đã sạch thì không làm gì.
   Cột nào còn DEFAULT/CHECK constraint hoặc nằm trong index thì gỡ những thứ đó trước,
   nếu không SQL Server từ chối DROP COLUMN.

   CẢNH BÁO: sau khi chạy, nhánh code cũ nào còn map các cột này sẽ vỡ.
   ============================================================================= */

SET NOCOUNT ON;

DECLARE @targets TABLE (table_name SYSNAME, column_name SYSNAME);

INSERT INTO @targets (table_name, column_name) VALUES
    -- Hồ sơ ứng viên: mấy trường CV nâng cao chưa bao giờ được nhập
    ('Candidate',         'linkedin_url'),
    ('Candidate',         'current_position'),
    ('Candidate',         'years_experience'),
    -- Tin tuyển dụng: số lượng cần tuyển nằm ở Yêu cầu tuyển dụng, không ở Job;
    -- ngưỡng điểm CV thì thuộc phần chấm điểm ĐÃ BỎ (V030)
    ('Job',               'quantity'),
    ('Job',               'cv_score_threshold'),
    ('Job',               'closed_at'),
    -- Lịch phỏng vấn: tên vòng và thông tin phòng/link chưa dùng tới
    ('InterviewSchedule', 'round_name'),
    ('InterviewSlot',     'end_time'),
    ('InterviewSlot',     'location'),
    ('InterviewSlot',     'meeting_link'),
    -- Tiêu chí đánh giá: mô tả + thứ tự hiển thị chưa dùng
    ('EvaluationCriteria', 'description'),
    ('EvaluationCriteria', 'display_order'),
    -- Phiếu chấm: mốc nộp suy từ status + updated_at
    ('InterviewScore',    'submitted_at'),
    -- Công ty: 3 cột của bản SaaS nhiều gói, hiện chỉ có một gói
    ('Company',           'industry'),
    ('Company',           'subscription_plan'),
    ('Company',           'status'),
    -- EmailLog: bảng chết, không entity nào của EF trỏ vào
    ('EmailLog',          'to_email'),
    ('EmailLog',          'subject'),
    ('EmailLog',          'error_message');

DECLARE @tbl SYSNAME, @col SYSNAME, @sql NVARCHAR(MAX), @dropped INT = 0;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT table_name, column_name FROM @targets;
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID('dbo.' + @tbl, 'U') IS NOT NULL
       AND COL_LENGTH('dbo.' + @tbl, @col) IS NOT NULL
    BEGIN
        /* (1) DEFAULT constraint (tên tự sinh nên phải tra sys.*) */
        SET @sql = N'';
        SELECT @sql = @sql + N'ALTER TABLE dbo.[' + @tbl + N'] DROP CONSTRAINT [' + dc.name + N'];'
        FROM sys.default_constraints dc
        JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
        WHERE dc.parent_object_id = OBJECT_ID('dbo.' + @tbl) AND c.name = @col;
        IF LEN(@sql) > 0 EXEC sp_executesql @sql;

        /* (2) CHECK constraint tham chiếu cột */
        SET @sql = N'';
        SELECT @sql = @sql + N'ALTER TABLE dbo.[' + @tbl + N'] DROP CONSTRAINT [' + cc.name + N'];'
        FROM sys.check_constraints cc
        JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
        WHERE cc.parent_object_id = OBJECT_ID('dbo.' + @tbl) AND c.name = @col;
        IF LEN(@sql) > 0 EXEC sp_executesql @sql;

        /* (3) Index có chứa cột (kể cả index phủ) */
        SET @sql = N'';
        SELECT @sql = @sql + N'DROP INDEX [' + i.name + N'] ON dbo.[' + @tbl + N'];'
        FROM sys.indexes i
        JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        WHERE i.object_id = OBJECT_ID('dbo.' + @tbl)
          AND i.is_primary_key = 0 AND i.is_unique_constraint = 0
          AND c.name = @col
        GROUP BY i.name;
        IF LEN(@sql) > 0 EXEC sp_executesql @sql;

        /* (4) Xoá cột */
        SET @sql = N'ALTER TABLE dbo.[' + @tbl + N'] DROP COLUMN [' + @col + N'];';
        EXEC sp_executesql @sql;

        SET @dropped = @dropped + 1;
        PRINT N'  đã xoá ' + @tbl + N'.' + @col;
    END

    FETCH NEXT FROM cur INTO @tbl, @col;
END

CLOSE cur;
DEALLOCATE cur;

PRINT N'Migration V032 xong: xoá ' + CAST(@dropped AS NVARCHAR(10)) + N' cột không dùng.';
GO
