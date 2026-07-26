/* =============================================================================
   MIGRATION V023 — gắn Department Manager vào PHÒNG BAN.

   Trước: DM chỉ gắn theo từng Job (Job.department_manager_id), Recruiter phải nhớ chọn tay.
   Quên chọn -> job.department_manager_id = NULL -> theo OfferService, BẤT KỲ ai cũng quyết
   được offer của job đó. Và ở cửa OFFER->HIRED thì không kiểm gì cả, DM phòng khác vẫn duyệt được.

   Sau: Department.manager_user_id trả lời câu hỏi "phòng ban này ai duyệt?".
     - Recruiter chọn phòng ban lúc tạo job -> BE tự điền job.department_manager_id (vẫn override được).
     - Cửa OFFER->HIRED kiểm đúng DM của job (Admin bỏ qua — superuser).

   FK đặt ở Department (KHÔNG phải User.department_id) để Recruiter/Admin/Interviewer
   không sinh cột NULL vô nghĩa. 1 phòng ban -> 1 DM; 1 DM quản được nhiều phòng ban.

   Backfill: phòng ban nào mà các job của nó chỉ trỏ về DUY NHẤT 1 DM -> lấy luôn DM đó.
   Nhập nhằng (nhiều DM khác nhau) -> để NULL, Admin tự chọn. Idempotent.
   ============================================================================= */

IF COL_LENGTH('dbo.Department', 'manager_user_id') IS NULL
BEGIN
    ALTER TABLE dbo.Department ADD manager_user_id BIGINT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Department_Manager')
    ALTER TABLE dbo.Department
        ADD CONSTRAINT FK_Department_Manager FOREIGN KEY (manager_user_id) REFERENCES dbo.[User](user_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Department_manager' AND object_id = OBJECT_ID('dbo.Department'))
    CREATE NONCLUSTERED INDEX IX_Department_manager ON dbo.Department(manager_user_id) WHERE manager_user_id IS NOT NULL;
GO

/* Backfill chạy ngoài request (không có SESSION_CONTEXT) -> tắt policy rồi bật lại (pattern V022). */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
GO

UPDATE d
   SET d.manager_user_id = src.dm_id
FROM dbo.Department d
JOIN (
    SELECT j.company_id,
           j.department,
           MIN(j.department_manager_id) AS dm_id
    FROM dbo.Job j
    WHERE j.department IS NOT NULL
      AND j.department_manager_id IS NOT NULL
    GROUP BY j.company_id, j.department
    HAVING COUNT(DISTINCT j.department_manager_id) = 1   -- nhập nhằng thì bỏ qua, để Admin chọn
) src ON src.company_id = d.company_id AND src.department = d.name
WHERE d.manager_user_id IS NULL;
GO

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
GO
