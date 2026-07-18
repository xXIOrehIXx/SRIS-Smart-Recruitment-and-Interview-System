/* =============================================================================
   MIGRATION V019 — Panel NHIỀU interviewer / khung (Section 15 — mở rộng A).

   Trước: InterviewSlot.interviewer_id = 1 người phỏng vấn duy nhất.
   Sau: 1 khung có thể có 1..N interviewer (panel 3–5 người cùng dự buổi phỏng vấn).

   Bước:
   (1) Tạo bảng InterviewSlotInterviewer (bảng nối slot <-> user) + RLS + index.
   (2) Backfill: copy mọi slot hiện có vào bảng nối (giữ đúng 1 interviewer_id đang có).
   (3) Drop FK + column interviewer_id trên InterviewSlot.
   (4) Bỏ CHECK trùng (interviewer_id đã đi) — vẫn CHECK slot status.

   Idempotent. Dev DB: chỉ chạy nhánh backfill khi cột interviewer_id còn tồn tại.
   ============================================================================= */

/* ---------- (1) Bảng nối slot <-> interviewer ---------- */
IF OBJECT_ID('dbo.InterviewSlotInterviewer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InterviewSlotInterviewer (
        slot_id         BIGINT NOT NULL,
        company_id      BIGINT NOT NULL,
        interviewer_id  BIGINT NOT NULL,
        created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_SlotInt_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_InterviewSlotInterviewer PRIMARY KEY (slot_id, interviewer_id),
        CONSTRAINT FK_SlotInt_Slot        FOREIGN KEY (slot_id)        REFERENCES dbo.InterviewSlot(slot_id),
        CONSTRAINT FK_SlotInt_Interviewer FOREIGN KEY (interviewer_id) REFERENCES dbo.[User](user_id)
    );
    CREATE INDEX IX_SlotInt_interviewer ON dbo.InterviewSlotInterviewer(company_id, interviewer_id, slot_id);
    CREATE INDEX IX_SlotInt_slot        ON dbo.InterviewSlotInterviewer(slot_id);
END
GO

/* RLS cho bảng nối (3 lớp phòng thủ — 5.2). Idempotent. */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.InterviewSlotInterviewer'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewSlotInterviewer,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewSlotInterviewer;
GO

/* ---------- (2) Backfill (chỉ chạy khi cột interviewer_id còn) ----------
   Tách thành 3 lệnh con (mỗi lệnh có GO riêng) — IF chứa nhiều batch cần GO bên trong. */
IF COL_LENGTH('dbo.InterviewSlot', 'interviewer_id') IS NOT NULL
BEGIN
    IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
        ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
END
GO

IF COL_LENGTH('dbo.InterviewSlot', 'interviewer_id') IS NOT NULL
BEGIN
    INSERT INTO dbo.InterviewSlotInterviewer (slot_id, company_id, interviewer_id, created_at)
    SELECT slot_id, company_id, interviewer_id, ISNULL(created_at, SYSUTCDATETIME())
    FROM dbo.InterviewSlot
    WHERE interviewer_id IS NOT NULL AND interviewer_id > 0;
END
GO

IF COL_LENGTH('dbo.InterviewSlot', 'interviewer_id') IS NOT NULL
   AND OBJECT_ID('dbo.FK_Slot_Interviewer', 'F') IS NOT NULL
    ALTER TABLE dbo.InterviewSlot DROP CONSTRAINT FK_Slot_Interviewer;
GO

IF COL_LENGTH('dbo.InterviewSlot', 'interviewer_id') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Slot_interviewer'
               AND object_id = OBJECT_ID('dbo.InterviewSlot'))
    DROP INDEX IX_Slot_interviewer ON dbo.InterviewSlot;
GO

IF COL_LENGTH('dbo.InterviewSlot', 'interviewer_id') IS NOT NULL
    ALTER TABLE dbo.InterviewSlot DROP COLUMN interviewer_id;
GO

/* Bật lại policy sau khi drop cột xong. */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
GO

PRINT N'Migration V019 xong: InterviewSlotInterviewer (panel N-N) + drop InterviewSlot.interviewer_id.';
GO
