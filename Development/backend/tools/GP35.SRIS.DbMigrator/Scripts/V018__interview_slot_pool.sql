/* =============================================================================
   MIGRATION V018 — Pool khung phỏng vấn DÙNG CHUNG (Section 15).

   Đổi mô hình đặt lịch từ 1-1 (mỗi ứng viên 1 bộ khung riêng) sang POOL dùng chung:
   - Bảng mới InterviewSlotPool: 1 bộ khung gắn job + vòng, nhiều ứng viên cùng chọn.
   - InterviewSlot đổi chủ: schedule_id -> pool_id; thêm booked_application_id (ai đã lấy khung).
   - InterviewSchedule: thêm pool_id (pool mà ứng viên được mời vào). Tạo lúc MỜI, chốt lúc đặt khung.

   Idempotent. Dev DB: dữ liệu lịch 1-1 cũ không còn ý nghĩa -> DỌN sạch (score/slot/schedule)
   trước khi đổi cấu trúc (chỉ chạy nhánh dọn khi cột schedule_id còn tồn tại = chưa migrate).
   ============================================================================= */

/* ---------- 1) Bảng pool ---------- */
IF OBJECT_ID('dbo.InterviewSlotPool', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InterviewSlotPool (
        pool_id       BIGINT IDENTITY(1,1) NOT NULL,
        company_id    BIGINT               NOT NULL,
        job_id        BIGINT               NOT NULL,
        round_number  INT                  NOT NULL CONSTRAINT DF_Pool_round DEFAULT 1,
        status        VARCHAR(20)          NOT NULL CONSTRAINT DF_Pool_status DEFAULT 'OPEN',
        created_by    BIGINT               NULL,
        created_at    DATETIME2(3)         NOT NULL CONSTRAINT DF_Pool_created DEFAULT SYSUTCDATETIME(),
        updated_at    DATETIME2(3)         NULL,
        CONSTRAINT PK_InterviewSlotPool PRIMARY KEY (pool_id),
        CONSTRAINT FK_Pool_Company   FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_Pool_Job       FOREIGN KEY (job_id)     REFERENCES dbo.Job(job_id),
        CONSTRAINT FK_Pool_CreatedBy FOREIGN KEY (created_by) REFERENCES dbo.[User](user_id),
        CONSTRAINT CK_Pool_status    CHECK (status IN ('OPEN','CLOSED','CANCELLED'))
    );
    CREATE NONCLUSTERED INDEX IX_Pool_company ON dbo.InterviewSlotPool(company_id);
    CREATE NONCLUSTERED INDEX IX_Pool_job     ON dbo.InterviewSlotPool(job_id);
END
GO

/* RLS: đưa bảng pool vào cô lập tenant như mọi bảng con (coding rule #1). Idempotent. */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.InterviewSlotPool'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewSlotPool,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewSlotPool;
GO

/* ---------- 2) Dọn dữ liệu lịch 1-1 cũ (chỉ khi chưa migrate) ----------
   RLS: fn_TenantPredicate ẩn MỌI dòng khi SESSION_CONTEXT('CompanyId') chưa set (migrator),
   nên phải tắt security policy để DELETE ăn dòng thật (không sẽ để lại orphan làm hỏng FK mới). */
IF COL_LENGTH('dbo.InterviewSlot', 'schedule_id') IS NOT NULL
BEGIN
    IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
        ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);

    DELETE FROM dbo.InterviewScore;                             -- FK -> InterviewSchedule
    UPDATE dbo.InterviewSchedule SET confirmed_slot_id = NULL;  -- gỡ FK vòng trước khi xóa slot
    DELETE FROM dbo.InterviewSlot;
    DELETE FROM dbo.InterviewSchedule;

    IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
        ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
END
GO

/* ---------- 3) InterviewSlot: schedule_id -> pool_id + booked_application_id ---------- */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Slot_schedule'
           AND object_id = OBJECT_ID('dbo.InterviewSlot'))
    DROP INDEX IX_Slot_schedule ON dbo.InterviewSlot;
GO

IF OBJECT_ID('dbo.FK_Slot_Schedule', 'F') IS NOT NULL
    ALTER TABLE dbo.InterviewSlot DROP CONSTRAINT FK_Slot_Schedule;
GO

IF COL_LENGTH('dbo.InterviewSlot', 'schedule_id') IS NOT NULL
    ALTER TABLE dbo.InterviewSlot DROP COLUMN schedule_id;
GO

IF COL_LENGTH('dbo.InterviewSlot', 'pool_id') IS NULL
    ALTER TABLE dbo.InterviewSlot ADD pool_id BIGINT NOT NULL CONSTRAINT DF_Slot_pool DEFAULT 0;
GO
-- Bỏ default tạm (chỉ để ADD cột NOT NULL an toàn); giá trị luôn do app gán khi insert.
IF OBJECT_ID('dbo.DF_Slot_pool', 'D') IS NOT NULL
    ALTER TABLE dbo.InterviewSlot DROP CONSTRAINT DF_Slot_pool;
GO

IF COL_LENGTH('dbo.InterviewSlot', 'booked_application_id') IS NULL
    ALTER TABLE dbo.InterviewSlot ADD booked_application_id BIGINT NULL;
GO

IF OBJECT_ID('dbo.FK_Slot_Pool', 'F') IS NULL
    ALTER TABLE dbo.InterviewSlot
        ADD CONSTRAINT FK_Slot_Pool FOREIGN KEY (pool_id) REFERENCES dbo.InterviewSlotPool(pool_id);
GO

IF OBJECT_ID('dbo.FK_Slot_BookedApp', 'F') IS NULL
    ALTER TABLE dbo.InterviewSlot
        ADD CONSTRAINT FK_Slot_BookedApp FOREIGN KEY (booked_application_id) REFERENCES dbo.Application(application_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Slot_pool'
               AND object_id = OBJECT_ID('dbo.InterviewSlot'))
    CREATE NONCLUSTERED INDEX IX_Slot_pool ON dbo.InterviewSlot(pool_id);
GO

/* ---------- 4) InterviewSchedule: thêm pool_id ---------- */
IF COL_LENGTH('dbo.InterviewSchedule', 'pool_id') IS NULL
    ALTER TABLE dbo.InterviewSchedule ADD pool_id BIGINT NULL;
GO

IF OBJECT_ID('dbo.FK_Sched_Pool', 'F') IS NULL
    ALTER TABLE dbo.InterviewSchedule
        ADD CONSTRAINT FK_Sched_Pool FOREIGN KEY (pool_id) REFERENCES dbo.InterviewSlotPool(pool_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sched_pool'
               AND object_id = OBJECT_ID('dbo.InterviewSchedule'))
    CREATE NONCLUSTERED INDEX IX_Sched_pool ON dbo.InterviewSchedule(pool_id);
GO

PRINT N'Migration V018 xong: InterviewSlotPool + InterviewSlot.pool_id/booked_application_id + InterviewSchedule.pool_id.';
GO
