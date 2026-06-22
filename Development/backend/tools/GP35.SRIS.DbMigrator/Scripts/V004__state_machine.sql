/* =============================================================================
   MIGRATION V004 — state machine hồ sơ (docs 5.8) + audit transition.
   Bổ sung cột timestamp pipeline cho Application và cột chi tiết cho ActivityLog
   (entity .NET đã có; schema rút gọn V001 chưa có). Idempotent.

   7 state: NEW -> SCREENING -> QUIZ -> INTERVIEW -> OFFER -> HIRED / REJECTED.
   Forward-only; reject từ NEW/SCREENING/QUIZ/INTERVIEW/OFFER -> REJECTED (bắt buộc reason).
   ============================================================================= */

/* (1) Application: mốc thời gian theo pipeline (analytics time-in-stage, KPI). */
IF COL_LENGTH('dbo.Application', 'stage_updated_at') IS NULL
    ALTER TABLE dbo.Application ADD stage_updated_at DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.Application', 'rejected_at') IS NULL
    ALTER TABLE dbo.Application ADD rejected_at DATETIME2(3) NULL;
GO
IF COL_LENGTH('dbo.Application', 'hired_at') IS NULL
    ALTER TABLE dbo.Application ADD hired_at DATETIME2(3) NULL;
GO

/* (2) ActivityLog: mỗi transition ghi 1 dòng (ai, từ state nào -> state nào, lý do).
   Trả lời câu hội đồng "ai thêm/sửa gì lúc nào" (docs 5.6) — audit không dựa trí nhớ người. */
IF COL_LENGTH('dbo.ActivityLog', 'from_state') IS NULL
    ALTER TABLE dbo.ActivityLog ADD from_state VARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.ActivityLog', 'to_state') IS NULL
    ALTER TABLE dbo.ActivityLog ADD to_state VARCHAR(20) NULL;
GO
IF COL_LENGTH('dbo.ActivityLog', 'detail') IS NULL
    ALTER TABLE dbo.ActivityLog ADD detail NVARCHAR(500) NULL;
GO

PRINT N'Migration V004 xong: Application.stage_updated_at/rejected_at/hired_at; ActivityLog.from_state/to_state/detail.';
GO
