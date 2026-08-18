/* =============================================================================
   MIGRATION V045 — Trưởng bộ phận chỉ định NGƯỜI PHỎNG VẤN cho từng ứng viên
   (chốt 16/08/2026).

   Vấn đề: bộ phận nhân sự đang vừa xếp giờ vừa CHỌN ai đi phỏng vấn ai
   (BookInterviewDto.interviewer_ids nhận id tùy ý). Chọn người gặp ứng viên là
   chuyên môn của Trưởng bộ phận — cùng một mạch với việc họ duyệt ứng viên vào
   vòng phỏng vấn, không phải việc của nhân sự.

   Sau migration này:
     - DM duyệt ứng viên vào vòng phỏng vấn -> chỉ định luôn danh sách người
       phỏng vấn (ghi vào bảng này).
     - Nhân sự đặt buổi chỉ được chọn TRONG danh sách đó (BE chặn id ngoài danh sách).

   KHÔNG gắn round_number: đây là "những ai được phép gặp ứng viên này", mỗi buổi
   nhân sự chọn một tập con. Vòng sau cần người khác thì DM chỉ định lại.

   Idempotent.
   ============================================================================= */

/* ---------- 1) Bảng phân công ---------- */
IF OBJECT_ID('dbo.ApplicationInterviewer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ApplicationInterviewer (
        company_id     BIGINT       NOT NULL,
        application_id BIGINT       NOT NULL,
        interviewer_id BIGINT       NOT NULL,

        -- DM đã chỉ định (NULL = dữ liệu backfill từ buổi đã đặt trước V045).
        assigned_by    BIGINT       NULL,
        assigned_at    DATETIME2(3) NOT NULL
            CONSTRAINT DF_AppInterviewer_assigned DEFAULT SYSUTCDATETIME(),

        -- Khóa chính đôi = một người chỉ nằm trong danh sách của một hồ sơ ĐÚNG MỘT lần;
        -- không cần UNIQUE riêng.
        CONSTRAINT PK_ApplicationInterviewer PRIMARY KEY (application_id, interviewer_id),
        CONSTRAINT FK_AppInterviewer_Company    FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_AppInterviewer_App        FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
        CONSTRAINT FK_AppInterviewer_User       FOREIGN KEY (interviewer_id) REFERENCES dbo.[User](user_id),
        CONSTRAINT FK_AppInterviewer_AssignedBy FOREIGN KEY (assigned_by)    REFERENCES dbo.[User](user_id)
    );
    CREATE NONCLUSTERED INDEX IX_AppInterviewer_company
        ON dbo.ApplicationInterviewer(company_id, application_id);
END
GO

/* ---------- 2) Backfill từ các buổi ĐÃ đặt ----------
   Hồ sơ đã có buổi phỏng vấn trước V045 thì panel của buổi đó chính là danh sách
   DM (lẽ ra) đã chỉ định. Không backfill thì mọi hồ sơ đang dở dang bị chặn đặt
   buổi tiếp cho tới khi DM vào bấm lại — dữ liệu demo gãy ngang.

   Hồ sơ đang ở vòng phỏng vấn nhưng CHƯA có buổi nào thì không có nguồn để suy —
   đúng luật mới: DM phải chỉ định trước khi nhân sự xếp lịch.

   Đọc InterviewSchedule/InterviewSlot (có RLS) từ connection không set
   SESSION_CONTEXT -> phải tắt policy trong lúc backfill, như V019. */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
GO

INSERT INTO dbo.ApplicationInterviewer (company_id, application_id, interviewer_id, assigned_by)
SELECT DISTINCT sch.company_id, sch.application_id, si.interviewer_id, NULL
FROM dbo.InterviewSchedule sch
JOIN dbo.InterviewSlot sl            ON sl.slot_id = sch.confirmed_slot_id
JOIN dbo.InterviewSlotInterviewer si ON si.slot_id = sl.slot_id
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ApplicationInterviewer ai
    WHERE ai.application_id = sch.application_id
      AND ai.interviewer_id = si.interviewer_id);
GO

IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
GO

/* ---------- 3) RLS ----------
   Cô lập tenant như mọi bảng có company_id (coding rule #1). Idempotent. */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.ApplicationInterviewer'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.ApplicationInterviewer,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.ApplicationInterviewer;
GO
