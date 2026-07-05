/* =============================================================================
   MIGRATION V012 — LOẠI MODULE QUIZ KHỎI SCOPE (tái định vị hậu-hội-đồng, docs Section 3 OUT).
   State machine còn 6 state (NEW/SCREENING/INTERVIEW/OFFER/HIRED/REJECTED — 5.8);
   magic link còn 3 purpose (SCHEDULE/STATUS/OFFER_RESPONSE — 5.13).

   Thứ tự: (1) dọn dữ liệu (cần tắt RLS như V006 vì migration không có session context)
   -> (2) siết lại CHECK constraint -> (3) gỡ predicate RLS khỏi các bảng quiz
   -> (4) drop bảng theo chiều FK. Idempotent.
   ============================================================================= */

/* (1) Dọn dữ liệu — tắt security policy để thấy dòng của mọi tenant (pattern V006). */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
GO

/* Hồ sơ đang ở QUIZ -> đưa về SCREENING (không tự tiến hộ ứng viên — Recruiter
   quyết chuyển INTERVIEW sau). Ghi ActivityLog để giữ audit trail. */
INSERT INTO dbo.ActivityLog (company_id, application_id, user_id, action, from_state, to_state, detail)
SELECT company_id, application_id, NULL, 'STATE_CHANGE', 'QUIZ', 'SCREENING',
       N'Migration V012: module quiz loại khỏi scope — hồ sơ trả về Sàng lọc.'
FROM dbo.Application
WHERE current_state = 'QUIZ';
GO
UPDATE dbo.Application
SET current_state = 'SCREENING',
    stage_updated_at = SYSUTCDATETIME(),
    updated_at = SYSUTCDATETIME()
WHERE current_state = 'QUIZ';
GO

/* Token purpose QUIZ không còn dùng — xóa hẳn (token đã hash, không khôi phục được). */
DELETE FROM dbo.MagicLinkToken WHERE purpose = 'QUIZ';
GO

/* Email template loại QUIZ: gỡ tham chiếu từ EmailLog (giữ log gửi) rồi xóa template. */
UPDATE el SET el.template_id = NULL
FROM dbo.EmailLog el
JOIN dbo.EmailTemplate t ON t.template_id = el.template_id
WHERE t.type = 'QUIZ';
GO
DELETE FROM dbo.EmailTemplate WHERE type = 'QUIZ';
GO

IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
GO

/* (2) Siết lại CHECK: 6 state + 3 purpose. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_App_state')
    ALTER TABLE dbo.Application DROP CONSTRAINT CK_App_state;
GO
ALTER TABLE dbo.Application
    ADD CONSTRAINT CK_App_state CHECK (current_state IN
        ('NEW','SCREENING','INTERVIEW','OFFER','HIRED','REJECTED'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Token_purpose')
    ALTER TABLE dbo.MagicLinkToken DROP CONSTRAINT CK_Token_purpose;
GO
ALTER TABLE dbo.MagicLinkToken
    ADD CONSTRAINT CK_Token_purpose CHECK (purpose IN
        ('SCHEDULE','STATUS','OFFER_RESPONSE'));
GO

/* (3) Gỡ predicate RLS khỏi các bảng quiz (bắt buộc trước khi DROP TABLE). */
IF EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.AntiCheatEvent'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        DROP FILTER PREDICATE ON dbo.AntiCheatEvent,
        DROP BLOCK  PREDICATE ON dbo.AntiCheatEvent;
GO
IF EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.QuizAnswer'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        DROP FILTER PREDICATE ON dbo.QuizAnswer,
        DROP BLOCK  PREDICATE ON dbo.QuizAnswer;
GO
IF EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.QuizAttempt'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        DROP FILTER PREDICATE ON dbo.QuizAttempt,
        DROP BLOCK  PREDICATE ON dbo.QuizAttempt;
GO
IF EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.QuizQuestion'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        DROP FILTER PREDICATE ON dbo.QuizQuestion,
        DROP BLOCK  PREDICATE ON dbo.QuizQuestion;
GO
IF EXISTS (SELECT 1 FROM sys.security_predicates WHERE target_object_id = OBJECT_ID('dbo.Quiz'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        DROP FILTER PREDICATE ON dbo.Quiz,
        DROP BLOCK  PREDICATE ON dbo.Quiz;
GO

/* (4) Drop bảng theo chiều FK: con trước, cha sau. */
IF OBJECT_ID('dbo.AntiCheatEvent', 'U')    IS NOT NULL DROP TABLE dbo.AntiCheatEvent;
IF OBJECT_ID('dbo.QuizAnswer', 'U')        IS NOT NULL DROP TABLE dbo.QuizAnswer;
IF OBJECT_ID('dbo.QuizAttempt', 'U')       IS NOT NULL DROP TABLE dbo.QuizAttempt;
IF OBJECT_ID('dbo.QuizQuestion', 'U')      IS NOT NULL DROP TABLE dbo.QuizQuestion;
IF OBJECT_ID('dbo.Quiz', 'U')              IS NOT NULL DROP TABLE dbo.Quiz;
IF OBJECT_ID('dbo.QuestionBankItem', 'U')  IS NOT NULL DROP TABLE dbo.QuestionBankItem;
GO

PRINT N'Migration V012 xong: loại module quiz — drop 6 bảng quiz, state machine còn 6 state, magic link còn 3 purpose.';
GO
