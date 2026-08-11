/* =============================================================================
   MIGRATION V037 — HÀNG ĐỢI BÓC TIÊU CHÍ (chạy nền thay vì bắt người dùng ngồi đợi).

   Vì sao đổi: bóc tiêu chí gọi Local LLM chạy trên CPU, một JD thật mất hàng chục
   giây. Trước đây đây là lời gọi HTTP đồng bộ — trình duyệt bỏ cuộc ở giây 30
   (axios timeout) trong khi backend vẫn chạy tới giây 100, nên người dùng thấy
   "lỗi mạng" dù AI vẫn đang làm việc. Càng tệ hơn khi rơi vào retry: 3 lượt sinh
   JSON là gấp ba thời gian.

   Cách mới: bấm "Bóc tiêu chí" chỉ ghi một dòng PENDING rồi trả về ngay. Worker
   nền nhặt dòng đó, gọi AI service, ghi kết quả. Người dùng đi làm việc khác,
   quay lại xem.

   MỘT DÒNG / MỘT JOB (UNIQUE job_id): lượt bóc mới ghi đè trạng thái lượt cũ.
   Bảng này là "trạng thái lượt bóc gần nhất", không phải nhật ký lịch sử — bộ
   tiêu chí DRAFT sinh ra mới là kết quả thật, nằm ở EvaluationCriteria.

   Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.CriteriaExtraction', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CriteriaExtraction (
        extraction_id   BIGINT IDENTITY(1,1) NOT NULL,
        company_id      BIGINT               NOT NULL,
        job_id          BIGINT               NOT NULL,
        -- PENDING = đang xếp hàng | RUNNING = worker đang gọi AI
        -- DONE    = xong, có tiêu chí DRAFT chờ duyệt
        -- FAILED  = AI hỏng HOẶC JD không nêu yêu cầu nào (phân biệt bằng error_code)
        status          VARCHAR(20)          NOT NULL,
        -- Khớp ErrorCode phía .NET: AI_EXTRACT_FAILED / JD_NO_REQUIREMENTS.
        error_code      VARCHAR(50)          NULL,
        error_message   NVARCHAR(1000)       NULL,
        -- Số tiêu chí DRAFT bóc được (chỉ có nghĩa khi status = 'DONE').
        criteria_count  INT                  NULL,
        requested_by    BIGINT               NULL,
        requested_at    DATETIME2(3)         NOT NULL CONSTRAINT DF_CriteriaExtraction_req DEFAULT SYSUTCDATETIME(),
        started_at      DATETIME2(3)         NULL,
        finished_at     DATETIME2(3)         NULL,
        created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_CriteriaExtraction_created DEFAULT SYSUTCDATETIME(),
        updated_at      DATETIME2(3)         NULL,
        CONSTRAINT PK_CriteriaExtraction        PRIMARY KEY (extraction_id),
        CONSTRAINT FK_CriteriaExtraction_Co     FOREIGN KEY (company_id)   REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_CriteriaExtraction_Job    FOREIGN KEY (job_id)       REFERENCES dbo.Job(job_id),
        CONSTRAINT FK_CriteriaExtraction_User   FOREIGN KEY (requested_by) REFERENCES dbo.[User](user_id),
        -- Một job chỉ có một lượt bóc "đang sống": bấm lại = ghi đè, không xếp hàng chồng.
        CONSTRAINT UQ_CriteriaExtraction_job    UNIQUE (job_id),
        CONSTRAINT CK_CriteriaExtraction_status CHECK (status IN ('PENDING','RUNNING','DONE','FAILED'))
    );

    -- Worker quét theo status, xuyên tenant -> index dẫn đầu bằng status.
    CREATE INDEX IX_CriteriaExtraction_status ON dbo.CriteriaExtraction(status, requested_at);
END
GO

/* RLS — 3 lớp phòng thủ (5.2): bảng mới phải vào policy ngay, không để sót.
   Worker đọc hàng đợi xuyên tenant bằng raw SQL ngoài SESSION_CONTEXT (giống
   JobExpiryWorker), nhưng mọi truy cập từ request của người dùng vẫn qua RLS. */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.CriteriaExtraction'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.CriteriaExtraction,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.CriteriaExtraction;
GO

PRINT N'Migration V037 xong: CriteriaExtraction (hang doi boc tieu chi) + RLS.';
GO
