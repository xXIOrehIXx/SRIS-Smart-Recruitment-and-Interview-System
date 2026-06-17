/* ============================================================
   SEED 1 JOB DEMO để test luồng chấm điểm CV bằng vector.
   ------------------------------------------------------------
   LƯU Ý RLS: các bảng có Row-Level Security (TenantSecurityPolicy)
   theo SESSION_CONTEXT('CompanyId'). Phải set trước khi INSERT/SELECT,
   nếu không sẽ bị chặn (block predicate) hoặc trả rỗng (filter).
   App tự set qua ConnectionManager; còn khi chạy tay thì set như dưới.
   ============================================================ */

USE SRIS_dev;
GO

DECLARE @companyId BIGINT = 1;   -- đổi theo company đang test
EXEC sp_set_session_context @key = N'CompanyId', @value = @companyId;

INSERT INTO dbo.Job (company_id, title, jd_text, status)
VALUES (
    @companyId,
    N'Backend Developer (.NET)',
    N'Tuyển Backend Developer có kinh nghiệm vững về C# và .NET. '
  + N'Thành thạo ASP.NET Core, thiết kế và xây dựng REST API. '
  + N'Làm việc với SQL Server và Entity Framework Core. '
  + N'Hiểu kiến trúc microservice, biết Docker và CI/CD là lợi thế. '
  + N'Yêu cầu tối thiểu 2 năm kinh nghiệm phát triển web backend.',
    'Open'
);

SELECT job_id, title, status FROM dbo.Job WHERE company_id = @companyId;
PRINT N'Seed xong. Dùng job_id ở trên làm jobId khi nộp CV (embedding để NULL, hệ thống tự sinh lần chấm đầu).';
GO
