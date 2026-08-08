/* =============================================================================
   MIGRATION V030 — BỎ SÀNG LỌC CV BẰNG AI + TALENT POOL (chốt 08/08/2026).

   Đổi hướng: hệ thống KHÔNG chấm điểm/xếp hạng ứng viên nữa. AI chỉ còn một việc —
   BÓC TIÊU CHÍ từ JD để người duyệt chốt, rồi interviewer chấm phỏng vấn theo bộ
   tiêu chí đó. Sàng lọc hồ sơ trở lại là việc của con người.

   Bỏ theo:
     - ApplicationCriterionMatch (kết quả khớp/thiếu per-criterion của CV — V013)
     - Application.ai_match_score (điểm cả-CV JD↔CV — V001)
     - Application.criteria_score (điểm theo tiêu chí — V013)

   GIỮ LẠI (hạ tầng vector, không có tính năng nào dùng nhưng để nguyên cho rẻ):
     - CvChunk + CvDocument.embedding + Job.embedding + EvaluationCriteria.embedding
     - EvaluationCriteria.criteria_type / cv_matchable / keywords: vẫn là thuộc tính
       mô tả tiêu chí, phiếu chấm phỏng vấn còn đọc.

   CẢNH BÁO: nhánh code cũ (còn map 2 cột điểm) sẽ vỡ sau khi chạy script này.
   Idempotent.
   ============================================================================= */

/* ---------------------------------------------------------------------------
   (1) Gỡ RLS predicate TRƯỚC khi drop bảng — security policy còn trỏ vào bảng thì
       DROP TABLE bị chặn.
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
   AND EXISTS (SELECT 1 FROM sys.security_predicates
               WHERE target_object_id = OBJECT_ID('dbo.ApplicationCriterionMatch'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        DROP FILTER PREDICATE ON dbo.ApplicationCriterionMatch,
        DROP BLOCK  PREDICATE ON dbo.ApplicationCriterionMatch;
GO

IF OBJECT_ID('dbo.ApplicationCriterionMatch', 'U') IS NOT NULL
    DROP TABLE dbo.ApplicationCriterionMatch;
GO

/* ---------------------------------------------------------------------------
   (2) Application: bỏ 2 cột điểm. Cột có thể mang DEFAULT/CHECK constraint tên tự
       sinh -> gỡ constraint theo sys.* trước, rồi mới DROP COLUMN.
   --------------------------------------------------------------------------- */
DECLARE @sql NVARCHAR(MAX) = N'';

SELECT @sql = @sql + N'ALTER TABLE dbo.Application DROP CONSTRAINT [' + dc.name + N'];' + CHAR(10)
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.Application')
  AND c.name IN ('ai_match_score', 'criteria_score');

SELECT @sql = @sql + N'ALTER TABLE dbo.Application DROP CONSTRAINT [' + cc.name + N'];' + CHAR(10)
FROM sys.check_constraints cc
JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID('dbo.Application')
  AND c.name IN ('ai_match_score', 'criteria_score');

IF LEN(@sql) > 0 EXEC sp_executesql @sql;
GO

/* Index có phủ cột điểm (vd sắp xếp bảng xếp hạng) cũng phải đi trước cột. */
DECLARE @dropIx NVARCHAR(MAX) = N'';

SELECT @dropIx = @dropIx + N'DROP INDEX [' + i.name + N'] ON dbo.Application;' + CHAR(10)
FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID('dbo.Application')
  AND i.is_primary_key = 0
  AND c.name IN ('ai_match_score', 'criteria_score')
GROUP BY i.name;

IF LEN(@dropIx) > 0 EXEC sp_executesql @dropIx;
GO

IF COL_LENGTH('dbo.Application', 'ai_match_score') IS NOT NULL
    ALTER TABLE dbo.Application DROP COLUMN ai_match_score;
GO

IF COL_LENGTH('dbo.Application', 'criteria_score') IS NOT NULL
    ALTER TABLE dbo.Application DROP COLUMN criteria_score;
GO

PRINT N'Migration V030 xong: bỏ ApplicationCriterionMatch + Application.ai_match_score/criteria_score. Hạ tầng vector (CvChunk, embedding) giữ nguyên.';
GO
