/* =============================================================================
   MIGRATION V024 — Số năm kinh nghiệm tối thiểu trên Yêu cầu tuyển dụng (docs 5.17).

   Trước đây DM chỉ chọn được CẤP BẬC (experience_level: Fresher/Junior/Mid/...).
   Người duyệt đọc "Mid" không biết là mấy năm, và cấp bậc mỗi công ty hiểu một kiểu.
   Thêm số năm cụ thể để DM ra đề chính xác: nhập 2 -> "Ít nhất 2 năm".

   experience_level GIỮ NGUYÊN (không drop): các yêu cầu tạo trước migration này chỉ có
   cấp bậc, màn hiển thị rơi về cấp bậc khi số năm NULL.
   Idempotent.
   ============================================================================= */

IF COL_LENGTH('dbo.RecruitmentRequest', 'experience_years_min') IS NULL
    ALTER TABLE dbo.RecruitmentRequest ADD experience_years_min INT NULL;
GO

/* 0 = chấp nhận người chưa có kinh nghiệm. Chặn số âm và số vô lý (> 50 năm). */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_RecruitReq_exp_years')
    ALTER TABLE dbo.RecruitmentRequest
        ADD CONSTRAINT CK_RecruitReq_exp_years
        CHECK (experience_years_min IS NULL OR experience_years_min BETWEEN 0 AND 50);
GO
