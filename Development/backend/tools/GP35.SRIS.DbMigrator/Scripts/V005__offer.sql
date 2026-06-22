/* =============================================================================
   MIGRATION V005 — Offer (docs 5.15). Bổ sung cột cho OfferDetail mà entity .NET
   đã có nhưng schema rút gọn V001 chưa có. Idempotent.

   Luồng: tại cửa INTERVIEW->OFFER, Department Manager của job quyết tuyển
   (job không gán DM -> Recruiter quyết) -> tạo OfferDetail (PENDING) + phát
   magic link OFFER_RESPONSE -> ứng viên tự Đồng ý/Từ chối -> HIRED / REJECTED.
   ============================================================================= */

/* decided_by: ai chốt offer (DM của job, hoặc Recruiter nếu job không gán DM). */
IF COL_LENGTH('dbo.OfferDetail', 'decided_by') IS NULL
    ALTER TABLE dbo.OfferDetail ADD decided_by BIGINT NULL;
GO

/* note: ghi chú nội bộ kèm offer (ngoài lương/ngày vào làm). */
IF COL_LENGTH('dbo.OfferDetail', 'note') IS NULL
    ALTER TABLE dbo.OfferDetail ADD note NVARCHAR(500) NULL;
GO

/* expires_at: hạn ứng viên phản hồi offer (KPI offer acceptance rate). */
IF COL_LENGTH('dbo.OfferDetail', 'expires_at') IS NULL
    ALTER TABLE dbo.OfferDetail ADD expires_at DATETIME2(3) NULL;
GO

PRINT N'Migration V005 xong: OfferDetail.decided_by/note/expires_at.';
GO
