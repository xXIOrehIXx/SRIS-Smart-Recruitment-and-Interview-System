/* =============================================================================
   MIGRATION V008 — Dời/Hủy lịch phỏng vấn (Section 15). Bổ sung bộ đếm số lần dời lịch
   cho InterviewSchedule để ép luật nghiệp vụ: mỗi lịch chỉ được DỜI 1 LẦN. Idempotent.

   reschedule_count = số lần Recruiter mở lại khung (đưa lịch về PENDING). Hủy lịch dùng lại
   status='CANCELLED' đã có sẵn ở V001 (CK_Sched_status), không cần cột mới.
   ============================================================================= */

/* reschedule_count: số lần đã dời. Chặn dời lần thứ 2 ở tầng service (>= 1 -> từ chối). */
IF COL_LENGTH('dbo.InterviewSchedule', 'reschedule_count') IS NULL
    ALTER TABLE dbo.InterviewSchedule
        ADD reschedule_count INT NOT NULL CONSTRAINT DF_Sched_reschedule DEFAULT 0;
GO

PRINT N'Migration V008 xong: InterviewSchedule.reschedule_count.';
GO
