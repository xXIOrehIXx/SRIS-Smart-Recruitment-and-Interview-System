/* =============================================================================
   MIGRATION V047 — TỔNG HỢP Ý KIẾN HỘI ĐỒNG PHỎNG VẤN BẰNG AI (hàng đợi + kết quả).

   Phản hồi hội đồng 18/08/2026: "màn hình tổng hợp ý kiến interviewer cần AI".
   Trưởng bộ phận/Giám đốc bấm một nút, AI đọc các phiếu chấm ĐÃ NỘP của ứng viên
   rồi trả về: một đoạn tổng hợp, các điểm cả hội đồng đồng ý, các điểm mâu thuẫn,
   và những chỗ còn bỏ ngỏ nên hỏi thêm.

   RANH GIỚI (giống hệt CvScreening V044): AI KHÔNG kết luận nên tuyển hay không.
   Bảng này không có cột nào mang nghĩa "quyết định", và không đường code nào đọc
   nó rồi đổi current_state. Quyền quyết tuyển vẫn của Giám đốc (V043).

   MỘT DÒNG / MỘT HỒ SƠ (UNIQUE application_id): bấm tổng hợp lại = ghi đè. Đây là
   "bản tổng hợp gần nhất", không phải nhật ký — cùng hình dạng CriteriaExtraction
   (V037) và CvScreening (V044), dùng chung kiểu worker.

   source_verdict_count: số phiếu AI đã đọc lúc sinh bản tóm tắt. Có thêm người nộp
   phiếu sau đó thì màn hình so số này với số phiếu hiện tại và nhắc "tóm tắt đã cũ"
   — không có nó thì người quyết đọc một bản tóm tắt thiếu phiếu mà không hề biết.

   Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.PanelSummary', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PanelSummary (
        summary_id           BIGINT IDENTITY(1,1) NOT NULL,
        company_id           BIGINT               NOT NULL,
        application_id       BIGINT               NOT NULL,
        -- PENDING = đang xếp hàng | RUNNING = worker đang gọi AI
        -- DONE    = xong, có kết quả để đọc
        -- FAILED  = AI hỏng HOẶC chưa có phiếu nào để tổng hợp (phân biệt bằng error_code)
        status               VARCHAR(20)          NOT NULL,
        -- Khớp PanelSummaryErrorCode phía .NET: AI_SUMMARY_FAILED / NO_VERDICTS.
        error_code           VARCHAR(50)          NULL,
        error_message        NVARCHAR(1000)       NULL,

        -- ----- Kết quả (chỉ có nghĩa khi status = 'DONE') -----
        consensus            NVARCHAR(MAX)        NULL,  -- 3-5 câu tổng hợp cả hội đồng
        agreements_json      NVARCHAR(MAX)        NULL,  -- ["điểm từ 2 người trở lên cùng nêu"]
        disagreements_json   NVARCHAR(MAX)        NULL,  -- ["chỗ các phiếu nói ngược nhau"]
        open_questions_json  NVARCHAR(MAX)        NULL,  -- ["nên hỏi thêm gì trước khi chốt"]
        source_verdict_count INT                  NULL,  -- số phiếu đã đọc lúc tổng hợp

        requested_by         BIGINT               NULL,
        requested_at         DATETIME2(3)         NOT NULL CONSTRAINT DF_PanelSummary_req DEFAULT SYSUTCDATETIME(),
        started_at           DATETIME2(3)         NULL,
        finished_at          DATETIME2(3)         NULL,
        created_at           DATETIME2(3)         NOT NULL CONSTRAINT DF_PanelSummary_created DEFAULT SYSUTCDATETIME(),
        updated_at           DATETIME2(3)         NULL,
        CONSTRAINT PK_PanelSummary        PRIMARY KEY (summary_id),
        CONSTRAINT FK_PanelSummary_Co     FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_PanelSummary_App    FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
        CONSTRAINT FK_PanelSummary_User   FOREIGN KEY (requested_by)   REFERENCES dbo.[User](user_id),
        CONSTRAINT UQ_PanelSummary_app    UNIQUE (application_id),
        CONSTRAINT CK_PanelSummary_status CHECK (status IN ('PENDING','RUNNING','DONE','FAILED'))
    );

    -- Worker quét theo status, xuyên tenant -> index dẫn đầu bằng status.
    CREATE INDEX IX_PanelSummary_status ON dbo.PanelSummary(status, requested_at);
END
GO

/* RLS — bảng mới phải vào policy ngay (5.2). Worker đọc hàng đợi xuyên tenant bằng raw SQL
   ngoài SESSION_CONTEXT (giống CvScreeningRepo); mọi truy cập từ request người dùng vẫn qua RLS. */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.PanelSummary'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.PanelSummary,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.PanelSummary;
GO

PRINT N'Migration V047 xong: PanelSummary (hang doi + ket qua tong hop y kien hoi dong) + RLS.';
GO
