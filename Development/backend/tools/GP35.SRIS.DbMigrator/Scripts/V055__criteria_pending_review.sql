/* =============================================================================
   MIGRATION V055 — Cửa DUYỆT của Trưởng bộ phận cho bộ tiêu chí (chốt 07/09/2026).

   VÌ SAO
   ------
   Từ V052 bộ tiêu chí có hai người ghi được (nhân sự toàn công ty + DM của đúng vị trí) và
   CẢ HAI đều bấm được nút chốt. Tức là không có cửa duyệt nào cả: nhân sự bóc AI xong tự
   chốt là bộ tiêu chí thành phiếu chấm phỏng vấn, Trưởng bộ phận — người RA ĐỀ — không
   nhất thiết nhìn thấy nó lần nào.

   Luồng mới (giữ nguyên vai đã chốt: DM ra đề, nhân sự lái vận hành):
       nhân sự bấm AI bóc tiêu chí   -> DRAFT
       nhân sự sửa/thêm/gỡ dòng      -> vẫn DRAFT
       nhân sự "Gửi Trưởng bộ phận"  -> PENDING          (khoá sửa)
       DM duyệt                      -> APPROVED         (mới thành phiếu chấm)
       DM trả về kèm ghi chú         -> DRAFT + review_note

   THÊM GÌ
   -------
   - status nhận thêm 'PENDING' (nới CHECK, không đổi dữ liệu sẵn có).
   - submitted_at / submitted_by : lượt gửi duyệt gần nhất.
   - reviewed_at / reviewed_by / review_note : lượt DM xử lý gần nhất. review_note chỉ có
     nghĩa ở nhánh TRẢ VỀ — nó là câu trả lời cho "vì sao bộ này chưa dùng được".

   VÌ SAO GHI CHÚ NẰM TRÊN TỪNG DÒNG chứ không phải một bảng "lượt duyệt" riêng: duyệt là
   thao tác trên CẢ BỘ tiêu chí của một vị trí, nhưng bảng này vốn đã lưu trạng thái theo
   dòng (status / approved_by / approved_at có từ V013). Thêm một bảng cha chỉ để giữ một
   câu ghi chú thì mọi truy vấn đang có phải join thêm, trong khi mọi dòng của cùng một bộ
   luôn được cập nhật cùng lúc bằng một câu UPDATE. Đọc ra thì lấy dòng có reviewed_at mới
   nhất.

   KHÔNG đụng tới: tiêu chí gõ tay và tiêu chí áp từ khuôn mẫu vẫn vào thẳng APPROVED như
   trước. Cửa duyệt này là của LUỒNG AI BÓC — chỗ mà máy sinh ra nội dung và cần người có
   chuyên môn của bộ phận nhìn lại.

   LƯU Ý sqlcmd: bảng có filtered index (UQ_Crit_job_name_active, V042) -> chạy kèm cờ -I.
   Idempotent.
   ============================================================================= */

SET XACT_ABORT ON;

/* ---------- 1) Nới CHECK của status để nhận thêm PENDING ---------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Crit_status')
BEGIN
    ALTER TABLE dbo.EvaluationCriteria DROP CONSTRAINT CK_Crit_status;
    PRINT N'V055: đã gỡ CK_Crit_status cũ (DRAFT/APPROVED).';
END
GO

ALTER TABLE dbo.EvaluationCriteria
    ADD CONSTRAINT CK_Crit_status CHECK (status IN ('DRAFT','PENDING','APPROVED'));
GO
PRINT N'V055: CK_Crit_status = DRAFT/PENDING/APPROVED.';
GO

/* ---------- 2) Dấu vết lượt gửi duyệt ---------- */
IF COL_LENGTH('dbo.EvaluationCriteria', 'submitted_at') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD submitted_at DATETIME2(3) NULL;
GO

IF COL_LENGTH('dbo.EvaluationCriteria', 'submitted_by') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD submitted_by BIGINT NULL;
GO

/* ---------- 3) Dấu vết lượt Trưởng bộ phận xử lý ---------- */
IF COL_LENGTH('dbo.EvaluationCriteria', 'reviewed_at') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD reviewed_at DATETIME2(3) NULL;
GO

IF COL_LENGTH('dbo.EvaluationCriteria', 'reviewed_by') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD reviewed_by BIGINT NULL;
GO

/* Ghi chú của Trưởng bộ phận khi TRẢ BỘ TIÊU CHÍ VỀ. Bắt buộc nhập ở tầng service: trả về
   mà không nói vì sao thì nhân sự chỉ biết bấm gửi lại y nguyên. */
IF COL_LENGTH('dbo.EvaluationCriteria', 'review_note') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD review_note NVARCHAR(1000) NULL;
GO

/* ---------- 4) Khoá ngoại người gửi / người duyệt ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Crit_SubmittedBy')
    ALTER TABLE dbo.EvaluationCriteria
        ADD CONSTRAINT FK_Crit_SubmittedBy FOREIGN KEY (submitted_by) REFERENCES dbo.[User](user_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Crit_ReviewedBy')
    ALTER TABLE dbo.EvaluationCriteria
        ADD CONSTRAINT FK_Crit_ReviewedBy FOREIGN KEY (reviewed_by) REFERENCES dbo.[User](user_id);
GO

/* ---------- 5) Hàng đợi "bộ tiêu chí đang chờ tôi duyệt" của DM ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria')
                  AND name = 'IX_Crit_pending')
    CREATE NONCLUSTERED INDEX IX_Crit_pending
        ON dbo.EvaluationCriteria (company_id, job_id)
        WHERE status = 'PENDING';
GO

PRINT N'V055 xong: EvaluationCriteria có cửa duyệt PENDING của Trưởng bộ phận.';
GO
