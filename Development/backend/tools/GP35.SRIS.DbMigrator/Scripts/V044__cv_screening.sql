/* =============================================================================
   MIGRATION V044 — SÀNG LỌC CV THEO JD BẰNG AI (hàng đợi + kết quả).

   Sàng lọc CV quay lại scope (16/08/2026). Người tuyển dụng mở màn chi tiết ứng
   viên, bấm một nút, AI đọc CV và đối chiếu với tin tuyển dụng: tóm tắt CV, liệt
   kê yêu cầu ĐẠT (kèm câu trích từ CV làm bằng chứng) / THIẾU, và đề xuất có nên
   mời phỏng vấn không.

   ĐỀ XUẤT LÀ THAM KHẢO, KHÔNG PHẢI QUYẾT ĐỊNH. Không có đường code nào đọc cột
   decision rồi tự đổi current_state của hồ sơ — chỉ người bấm mới đổi được state.
   Vì thế bảng này KHÔNG dính vào state machine, và xoá sạch bảng này cũng không
   làm hỏng pipeline.

   VÌ SAO LƯU chứ không gọi AI mỗi lần mở trang: một lượt sàng lọc là hàng chục
   giây Local LLM trên CPU. Sinh 1 lần, lưu lại, mở sau đọc từ DB.

   MỘT DÒNG / MỘT HỒ SƠ (UNIQUE application_id): bấm phân tích lại là ghi đè.
   Bảng này là "kết quả sàng lọc gần nhất", không phải nhật ký lịch sử — cùng
   hình dạng với CriteriaExtraction (V037) và dùng chung kiểu worker.

   Kết quả lưu dạng JSON trong 2 cột (matched_json/missing_json) thay vì tách bảng
   con: đây là văn bản do AI sinh, chỉ để HIỂN THỊ NGUYÊN KHỐI trên đúng một màn
   hình. Không có truy vấn nào lọc/thống kê theo từng dòng kỹ năng, nên tách bảng
   chỉ tốn 2 bảng + 2 FK + 2 predicate RLS mà không mua được gì.

   Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.CvScreening', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CvScreening (
        screening_id    BIGINT IDENTITY(1,1) NOT NULL,
        company_id      BIGINT               NOT NULL,
        -- Khoá theo HỒ SƠ chứ không theo CV: cùng một CV nộp vào hai vị trí khác nhau
        -- phải ra hai kết quả khác nhau, vì đối chiếu là CV <-> JD của vị trí đó.
        application_id  BIGINT               NOT NULL,
        job_id          BIGINT               NOT NULL,
        cv_id           BIGINT               NOT NULL,
        -- PENDING = đang xếp hàng | RUNNING = worker đang gọi AI
        -- DONE    = xong, có kết quả để đọc
        -- FAILED  = AI hỏng HOẶC không có text CV để đọc (phân biệt bằng error_code)
        status          VARCHAR(20)          NOT NULL,
        -- Khớp ScreeningErrorCode phía .NET: AI_SCREEN_FAILED / CV_NO_TEXT / JD_EMPTY.
        error_code      VARCHAR(50)          NULL,
        error_message   NVARCHAR(1000)       NULL,

        -- ----- Kết quả (chỉ có nghĩa khi status = 'DONE') -----
        summary         NVARCHAR(MAX)        NULL,  -- 3-5 câu chân dung nghề nghiệp
        matched_json    NVARCHAR(MAX)        NULL,  -- [{"requirement","evidence"}]
        missing_json    NVARCHAR(MAX)        NULL,  -- ["yêu cầu CV không nhắc tới"]
        fit_score       INT                  NULL,  -- 0-100, THAM KHẢO
        decision        VARCHAR(20)          NULL,  -- PROCEED | CONSIDER | REJECT
        decision_reason NVARCHAR(1000)       NULL,

        requested_by    BIGINT               NULL,
        requested_at    DATETIME2(3)         NOT NULL CONSTRAINT DF_CvScreening_req DEFAULT SYSUTCDATETIME(),
        started_at      DATETIME2(3)         NULL,
        finished_at     DATETIME2(3)         NULL,
        created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_CvScreening_created DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2(3)         NULL,
        CONSTRAINT PK_CvScreening          PRIMARY KEY (screening_id),
        CONSTRAINT FK_CvScreening_Co       FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_CvScreening_App      FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
        CONSTRAINT FK_CvScreening_Job      FOREIGN KEY (job_id)         REFERENCES dbo.Job(job_id),
        CONSTRAINT FK_CvScreening_Cv       FOREIGN KEY (cv_id)          REFERENCES dbo.CvDocument(cv_id),
        CONSTRAINT FK_CvScreening_User     FOREIGN KEY (requested_by)   REFERENCES dbo.[User](user_id),
        -- Một hồ sơ chỉ có một lượt "đang sống": bấm lại = ghi đè, không xếp hàng chồng.
        CONSTRAINT UQ_CvScreening_app      UNIQUE (application_id),
        CONSTRAINT CK_CvScreening_status   CHECK (status IN ('PENDING','RUNNING','DONE','FAILED')),
        CONSTRAINT CK_CvScreening_score    CHECK (fit_score IS NULL OR fit_score BETWEEN 0 AND 100),
        CONSTRAINT CK_CvScreening_decision CHECK (decision IS NULL OR decision IN ('PROCEED','CONSIDER','REJECT'))
    );

    -- Worker quét theo status, xuyên tenant -> index dẫn đầu bằng status.
    CREATE INDEX IX_CvScreening_status ON dbo.CvScreening(status, requested_at);
END
GO

/* RLS — 3 lớp phòng thủ (5.2): bảng mới phải vào policy ngay, không để sót.
   Worker đọc hàng đợi xuyên tenant bằng raw SQL ngoài SESSION_CONTEXT (giống
   CriteriaExtractionRepo), nhưng mọi truy cập từ request của người dùng vẫn qua RLS. */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.CvScreening'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.CvScreening,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.CvScreening;
GO

PRINT N'Migration V044 xong: CvScreening (hang doi + ket qua sang loc CV) + RLS.';
GO
