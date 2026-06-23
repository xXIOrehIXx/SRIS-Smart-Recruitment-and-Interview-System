/* =============================================================================
   MIGRATION V011 — Disclosure & Consent trước khi làm quiz (docs 5.5).
   Ứng viên phải tick "đồng ý có giám sát + làm bài độc lập" mới được vào làm.
   Bằng chứng đồng ý = mốc thời gian consent_at trên lượt làm (honor code + pháp lý).
   An toàn chạy lại (idempotent). DDL không bị RLS chặn nên không cần session context.
   ============================================================================= */

/* consent_at: thời điểm ứng viên tick đồng ý. NULL = chưa đồng ý (chưa được phát đề).
   Lượt làm chỉ được TẠO sau khi đồng ý -> started_at (timer) cũng bắt đầu từ lúc này. */
IF COL_LENGTH('dbo.QuizAttempt', 'consent_at') IS NULL
    ALTER TABLE dbo.QuizAttempt ADD consent_at DATETIME2(3) NULL;
GO

PRINT N'Migration V011 xong: QuizAttempt.consent_at (Disclosure & Consent — docs 5.5).';
GO
