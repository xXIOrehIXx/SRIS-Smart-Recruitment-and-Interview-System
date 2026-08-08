/* =============================================================================
   MIGRATION V031 — NHẬN XÉT + ĐỀ XUẤT CỦA NGƯỜI PHỎNG VẤN (chốt 08/08/2026).

   Trước đây phiếu chấm chỉ có ĐIỂM + note theo từng tiêu chí, nên màn "Quyết định
   tuyển dụng" của DM chỉ còn cách bày số ra cho DM tự suy. Nhưng DM là người chốt:
   thứ họ cần là "người phỏng vấn thấy sao, vì sao" chứ không phải trung bình
   có trọng số.

   InterviewFeedback = MỘT dòng cho mỗi (buổi, người chấm):
     - recommendation: STRONG_HIRE / HIRE / CONSIDER / NO_HIRE → câu trả lời thẳng
     - summary: vì sao (nhận xét tổng, viết tự do)

   Blind review giữ nguyên luật của InterviewScore: submitted_at NULL = còn nháp,
   người khác KHÔNG được thấy. Nộp phiếu mới đóng dấu submitted_at.
   Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.InterviewFeedback', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InterviewFeedback (
        feedback_id    BIGINT IDENTITY(1,1) NOT NULL,
        company_id     BIGINT               NOT NULL,
        schedule_id    BIGINT               NOT NULL,
        interviewer_id BIGINT               NOT NULL,
        recommendation VARCHAR(20)          NULL,          -- NULL khi còn nháp chưa chọn
        summary        NVARCHAR(2000)       NULL,
        submitted_at   DATETIME2(3)         NULL,          -- NULL = nháp (blind review)
        created_at     DATETIME2(3)         NOT NULL CONSTRAINT DF_Feedback_created DEFAULT SYSUTCDATETIME(),
        updated_at     DATETIME2(3)         NULL,
        CONSTRAINT PK_InterviewFeedback     PRIMARY KEY (feedback_id),
        CONSTRAINT FK_Feedback_Company      FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_Feedback_Schedule     FOREIGN KEY (schedule_id)    REFERENCES dbo.InterviewSchedule(schedule_id),
        CONSTRAINT FK_Feedback_Interviewer  FOREIGN KEY (interviewer_id) REFERENCES dbo.[User](user_id),
        CONSTRAINT UQ_Feedback_unique       UNIQUE (schedule_id, interviewer_id),
        CONSTRAINT CK_Feedback_recommend    CHECK (recommendation IS NULL
                                                   OR recommendation IN ('STRONG_HIRE','HIRE','CONSIDER','NO_HIRE'))
    );
    CREATE INDEX IX_Feedback_schedule ON dbo.InterviewFeedback(company_id, schedule_id);
END
GO

/* RLS — 3 lớp phòng thủ (5.2): bảng mới phải vào policy ngay, không để sót. */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.InterviewFeedback'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewFeedback,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewFeedback;
GO

PRINT N'Migration V031 xong: InterviewFeedback (recommendation + summary/buổi/người chấm) + RLS.';
GO
