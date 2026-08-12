/* =============================================================================
   MIGRATION V038 — BỎ criteria_type / cv_matchable / keywords khỏi EvaluationCriteria.

   V036 đã giữ lại ba cột này với lý do "vẫn là thuộc tính mô tả tiêu chí mà
   phiếu chấm phỏng vấn đọc". Rà lại thì lý do đó không đứng được:

     - Cả ba sinh ra cho MÁY CHẤM CV: criteria_type quyết định dò keyword hay so
       vector, keywords là cụm từ đem dò, cv_matchable để khỏi loại oan người
       không viết kỹ năng mềm vào CV. Chấm CV cắt khỏi scope 08/08/2026 (V030).
     - Không còn dòng code nào rẽ nhánh theo chúng — chỉ CRUD và hiển thị.
     - Nhưng chúng VẪN hiện lên màn hình và vẫn phải giải thích cho người dùng.
       Màn Tiêu chí còn nói với người dùng rằng "SOFT dùng để so khớp ngữ nghĩa
       bằng vector" — hứa một tính năng đã xoá từ V036.

   Kèm theo (phía ứng dụng, không phải DB): prompt bóc tiêu chí chỉ còn bóc thứ
   PHẢI HỎI MỚI BIẾT. Bằng cấp, chứng chỉ, bằng lái không lên phiếu chấm nữa —
   người tuyển dụng đã đối chiếu ở bước sàng lọc hồ sơ, và không ai ngồi trong
   buổi phỏng vấn cho điểm 0-10 dòng "có bằng lái xe B2". Trước script này người
   phỏng vấn BỊ CHẶN nộp phiếu tới khi chấm đủ cả những dòng như thế.

   Dữ liệu mất đi: nhãn phân loại + từ khóa của các tiêu chí đang có. Chấp nhận
   được — không tính năng nào đọc chúng, và tiêu chí (name/weight/max_score) thì
   giữ nguyên nên phiếu chấm cũ không hỏng.

   Idempotent.
   ============================================================================= */

/* ---------------------------------------------------------------------------
   Drop CHECK constraint trước — V013 gắn CK_Crit_type (criteria_type IN
   ('HARD','SOFT')) lên đúng cột sắp xoá, và SQL Server chặn DROP COLUMN chừng
   nào còn constraint bám vào (lỗi 5074). Tra ngược qua sql_expression_dependencies
   thay vì gọi thẳng tên: bắt được cả check nhiều cột lẫn check do bản DB cũ đặt
   tên khác.
   --------------------------------------------------------------------------- */
DECLARE @sqlCheck NVARCHAR(MAX) = N'';

SELECT @sqlCheck = @sqlCheck + N'ALTER TABLE dbo.EvaluationCriteria DROP CONSTRAINT '
                             + QUOTENAME(cc.name) + N';' + CHAR(13)
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.EvaluationCriteria')
  AND EXISTS (
        SELECT 1
        FROM sys.sql_expression_dependencies d
        JOIN sys.columns c
          ON c.object_id = d.referenced_id
         AND c.column_id = d.referenced_minor_id
        WHERE d.referencing_id = cc.object_id
          AND d.referenced_id = OBJECT_ID('dbo.EvaluationCriteria')
          AND c.name IN ('criteria_type', 'cv_matchable', 'keywords'));

IF @sqlCheck <> N'' EXEC sp_executesql @sqlCheck;
GO

/* ---------------------------------------------------------------------------
   Drop default constraint trước rồi mới drop cột — cột có DEFAULT thì
   ALTER TABLE ... DROP COLUMN bị chặn, và tên constraint do SQL Server tự sinh
   nên phải tra ngược từ sys.default_constraints chứ không đoán được.
   --------------------------------------------------------------------------- */
DECLARE @sql NVARCHAR(MAX) = N'';

SELECT @sql = @sql + N'ALTER TABLE dbo.EvaluationCriteria DROP CONSTRAINT '
                   + QUOTENAME(dc.name) + N';' + CHAR(13)
FROM sys.default_constraints dc
JOIN sys.columns c
  ON c.object_id = dc.parent_object_id
 AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.EvaluationCriteria')
  AND c.name IN ('criteria_type', 'cv_matchable', 'keywords');

IF @sql <> N'' EXEC sp_executesql @sql;
GO

/* Index trên các cột này (nếu từng tạo cho luồng lọc CV) cũng phải gỡ trước. */
IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE name = 'IX_EvaluationCriteria_criteria_type'
             AND object_id = OBJECT_ID('dbo.EvaluationCriteria'))
    DROP INDEX IX_EvaluationCriteria_criteria_type ON dbo.EvaluationCriteria;
GO

IF COL_LENGTH('dbo.EvaluationCriteria', 'criteria_type') IS NOT NULL
    ALTER TABLE dbo.EvaluationCriteria DROP COLUMN criteria_type;
GO

IF COL_LENGTH('dbo.EvaluationCriteria', 'cv_matchable') IS NOT NULL
    ALTER TABLE dbo.EvaluationCriteria DROP COLUMN cv_matchable;
GO

IF COL_LENGTH('dbo.EvaluationCriteria', 'keywords') IS NOT NULL
    ALTER TABLE dbo.EvaluationCriteria DROP COLUMN keywords;
GO

PRINT N'Migration V038 xong: bo criteria_type / cv_matchable / keywords cua EvaluationCriteria.';
