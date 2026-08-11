/* =============================================================================
   MIGRATION V036 — BỎ HẲN HẠ TẦNG VECTOR (embedding + CvChunk).

   V030 đã cắt chấm CV bằng AI và Talent Pool khỏi phạm vi, nhưng khi đó còn giữ
   lại hạ tầng vector "cho rẻ". Thực tế nó không rẻ: mỗi cột chết là một dòng
   Ignore() trong SrisDbContext, một method repo không ai gọi, và một câu hỏi
   "cái này dùng để làm gì?" không có câu trả lời. V034 đã rút ra đúng bài học đó
   khi từ chối giữ CvDocument.summary lại.

   Sau script này AI của hệ thống chỉ còn ĐÚNG MỘT đường: bóc tiêu chí từ JD
   bằng Local LLM. Không còn embedding, không còn vector search, không còn
   endpoint /embed.

   Bỏ theo:
     - CvChunk (bảng vector từng-đoạn CV — V013)
     - Job.embedding (V001/V011)
     - CvDocument.embedding (V001/V011)
     - EvaluationCriteria.embedding (V013)

   GIỮ LẠI: EvaluationCriteria.criteria_type / cv_matchable / keywords — vẫn là
   thuộc tính mô tả tiêu chí mà phiếu chấm phỏng vấn đọc, không phải hạ tầng vector.

   Idempotent.
   ============================================================================= */

/* ---------------------------------------------------------------------------
   (1) Gỡ RLS predicate TRƯỚC khi drop bảng — security policy còn trỏ vào bảng
       thì DROP TABLE bị chặn.
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
   AND EXISTS (SELECT 1 FROM sys.security_predicates
               WHERE target_object_id = OBJECT_ID('dbo.CvChunk'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        DROP FILTER PREDICATE ON dbo.CvChunk,
        DROP BLOCK  PREDICATE ON dbo.CvChunk;
GO

IF OBJECT_ID('dbo.CvChunk', 'U') IS NOT NULL
    DROP TABLE dbo.CvChunk;
GO

/* ---------------------------------------------------------------------------
   (2) Cột embedding — drop vector index trước (nếu có) rồi mới drop cột.
   --------------------------------------------------------------------------- */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'VX_Job_embedding' AND object_id = OBJECT_ID('dbo.Job'))
    DROP INDEX VX_Job_embedding ON dbo.Job;
GO

IF COL_LENGTH('dbo.Job', 'embedding') IS NOT NULL
    ALTER TABLE dbo.Job DROP COLUMN embedding;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'VX_Cv_embedding' AND object_id = OBJECT_ID('dbo.CvDocument'))
    DROP INDEX VX_Cv_embedding ON dbo.CvDocument;
GO

IF COL_LENGTH('dbo.CvDocument', 'embedding') IS NOT NULL
    ALTER TABLE dbo.CvDocument DROP COLUMN embedding;
GO

IF COL_LENGTH('dbo.EvaluationCriteria', 'embedding') IS NOT NULL
    ALTER TABLE dbo.EvaluationCriteria DROP COLUMN embedding;
GO

PRINT N'Migration V036 xong: bo CvChunk + cot embedding cua Job/CvDocument/EvaluationCriteria.';
GO
