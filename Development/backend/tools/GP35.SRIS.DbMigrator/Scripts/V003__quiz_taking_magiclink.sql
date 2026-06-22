/* =============================================================================
   MIGRATION V003 — luồng ứng viên làm quiz qua magic link.
   Bổ sung các cột runtime mà entity .NET cần nhưng schema rút gọn (V001) chưa có.
   An toàn chạy lại (idempotent). DDL không bị RLS chặn nên không cần session context.

   Bối cảnh (docs 5.6, 5.13): ứng viên nhận magic link purpose=QUIZ -> làm bài MCQ;
   timer-lượt tính ở SERVER; anti-cheat ghi sự kiện; "one-time" = đốt token khi NỘP.
   ============================================================================= */

/* (1) MagicLinkToken: đếm số lần truy cập (bảo mật — docs 5.13). */
IF COL_LENGTH('dbo.MagicLinkToken', 'access_count') IS NULL
    ALTER TABLE dbo.MagicLinkToken
        ADD access_count INT NOT NULL CONSTRAINT DF_Token_access DEFAULT 0;
GO

/* (2) QuizAttempt: trạng thái lượt làm + IP + tổng thời gian (giây).
   status: IN_PROGRESS = đang làm; SUBMITTED = ứng viên bấm nộp;
           AUTO_SUBMITTED = server tự nộp (hết giờ / vượt ngưỡng anti-cheat). */
IF COL_LENGTH('dbo.QuizAttempt', 'status') IS NULL
    ALTER TABLE dbo.QuizAttempt
        ADD status VARCHAR(20) NOT NULL CONSTRAINT DF_QA_status DEFAULT 'IN_PROGRESS';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_QA_status')
    ALTER TABLE dbo.QuizAttempt
        ADD CONSTRAINT CK_QA_status
        CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED'));
GO
IF COL_LENGTH('dbo.QuizAttempt', 'ip_address') IS NULL
    ALTER TABLE dbo.QuizAttempt ADD ip_address VARCHAR(45) NULL;
GO
IF COL_LENGTH('dbo.QuizAttempt', 'duration_seconds') IS NULL
    ALTER TABLE dbo.QuizAttempt ADD duration_seconds INT NULL;
GO

/* (3) QuizAnswer: thời điểm trả lời + thời gian dừng ở câu (phục vụ anti-cheat). */
IF COL_LENGTH('dbo.QuizAnswer', 'answered_at') IS NULL
    ALTER TABLE dbo.QuizAnswer ADD answered_at DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.QuizAnswer', 'time_spent_seconds') IS NULL
    ALTER TABLE dbo.QuizAnswer ADD time_spent_seconds INT NULL;
GO

/* (4) AntiCheatEvent: mức độ + chi tiết; nới CHECK event_type cho các sự kiện FE bắt thêm.
   FE bắt được: tab switch, blur/minimize, paste, copy, mở DevTools, đa màn hình,
   thoát fullscreen, mất mạng, ẩn tab (visibilitychange). */
IF COL_LENGTH('dbo.AntiCheatEvent', 'severity') IS NULL
    ALTER TABLE dbo.AntiCheatEvent ADD severity VARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.AntiCheatEvent', 'detail') IS NULL
    ALTER TABLE dbo.AntiCheatEvent ADD detail NVARCHAR(500) NULL;
GO
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ACE_event_type')
    ALTER TABLE dbo.AntiCheatEvent DROP CONSTRAINT CK_ACE_event_type;
GO
ALTER TABLE dbo.AntiCheatEvent
    ADD CONSTRAINT CK_ACE_event_type CHECK (event_type IN
        ('TAB_SWITCH', 'BLUR', 'DISCONNECT', 'MULTI_MONITOR', 'FULLSCREEN_EXIT',
         'PASTE', 'COPY', 'DEVTOOLS', 'VISIBILITY_HIDDEN'));
GO

PRINT N'Migration V003 xong: MagicLinkToken.access_count; QuizAttempt.status/ip_address/duration_seconds; QuizAnswer.answered_at/time_spent_seconds; AntiCheatEvent.severity/detail + nới CHECK event_type.';
GO
