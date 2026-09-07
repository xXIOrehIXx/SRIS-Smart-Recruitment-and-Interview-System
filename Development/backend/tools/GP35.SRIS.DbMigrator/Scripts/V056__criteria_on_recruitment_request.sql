/* =============================================================================
   MIGRATION V056 — bộ tiêu chí bắt đầu từ YÊU CẦU TUYỂN DỤNG, không phải từ Job.
   (chốt 07/09/2026)

   LUỒNG MỚI
   ---------
       Trưởng bộ phận tạo Yêu cầu tuyển dụng (mô tả vị trí + yêu cầu ứng viên)
         -> AI bóc tiêu chí NGAY TỪ CHÍNH YÊU CẦU ĐÓ            -> DRAFT
         -> Trưởng bộ phận sửa rồi duyệt (họ vừa ra đề vừa duyệt -> KHÔNG qua PENDING)
         -> Giám đốc duyệt yêu cầu                               (V047, không đổi)
         -> nhân sự tạo tin tuyển dụng TỪ yêu cầu đã duyệt
              -> bộ tiêu chí CHUYỂN sang job, thành phiếu chấm phỏng vấn ngay lúc đó
         -> Interviewer chấm

   Lý do: chỗ mô tả vị trí và chỗ ra đề tiêu chí vốn là MỘT việc, do CÙNG một người
   (Trưởng bộ phận) làm, dựa trên CÙNG một văn bản. Tách ra hai màn ở hai thời điểm
   khác nhau thì đến lúc phỏng vấn mới phát hiện vị trí chưa có phiếu chấm.

   THAY ĐỔI DỮ LIỆU
   ----------------
   1. EvaluationCriteria.job_id thành NULL được, thêm request_id.
      Một dòng tiêu chí đi qua hai giai đoạn:
        - còn ở yêu cầu:   request_id = X, job_id = NULL
        - job đã tạo:      request_id = X, job_id = Y   <- giữ request_id làm dấu vết nguồn
      CHUYỂN chứ không NHÂN BẢN: nhân bản thì sửa một bên không sang bên kia, và
      InterviewScore trỏ vào criteria_id nào cũng thành câu hỏi phải tra.

   2. CriteriaExtraction (hàng đợi bóc AI) cũng vậy: job_id NULL được, thêm request_id.
      Một lượt bóc thuộc về ĐÚNG MỘT trong hai.

   RÀNG BUỘC DUY NHẤT — chỗ dễ hỏng, nói rõ
   -----------------------------------------
   UQ_Crit_job_name_active (V042) là chỉ mục lọc trên (job_id, name) WHERE active = 1.
   SQL Server coi các giá trị NULL là BẰNG NHAU trong chỉ mục duy nhất, nên khi job_id
   thành NULL được thì hai tiêu chí trùng tên của HAI yêu cầu tuyển dụng KHÁC NHAU sẽ
   đụng nhau — dựng lại chỉ mục kèm điều kiện job_id IS NOT NULL, và thêm chỉ mục riêng
   cho phía yêu cầu.

   KHÔNG đụng dữ liệu cũ: mọi tiêu chí đang có giữ nguyên job_id, request_id = NULL.
   Job tạo trước migration này vẫn dùng bình thường qua màn Tiêu Chí của job.

   LƯU Ý sqlcmd: bảng có chỉ mục lọc -> chạy kèm cờ -I. Idempotent.
   ============================================================================= */

SET XACT_ABORT ON;

/* ---------- 1) EvaluationCriteria: job_id nullable + request_id ---------- */

-- Gỡ chỉ mục lọc TRƯỚC khi đổi kiểu cột (không gỡ thì ALTER COLUMN báo lỗi vì cột
-- đang nằm trong định nghĩa chỉ mục).
IF EXISTS (SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria') AND name = 'UQ_Crit_job_name_active')
BEGIN
    DROP INDEX UQ_Crit_job_name_active ON dbo.EvaluationCriteria;
    PRINT N'V056: đã gỡ tạm UQ_Crit_job_name_active để đổi kiểu job_id.';
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria') AND name = 'IX_Crit_job')
    DROP INDEX IX_Crit_job ON dbo.EvaluationCriteria;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria')
      AND name = 'job_id' AND is_nullable = 0
)
BEGIN
    ALTER TABLE dbo.EvaluationCriteria ALTER COLUMN job_id BIGINT NULL;
    PRINT N'V056: EvaluationCriteria.job_id -> NULL được.';
END
GO

IF COL_LENGTH('dbo.EvaluationCriteria', 'request_id') IS NULL
    ALTER TABLE dbo.EvaluationCriteria ADD request_id BIGINT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Crit_Request')
    ALTER TABLE dbo.EvaluationCriteria
        ADD CONSTRAINT FK_Crit_Request FOREIGN KEY (request_id)
            REFERENCES dbo.RecruitmentRequest(request_id);
GO

/* Một dòng tiêu chí phải neo vào ÍT NHẤT một trong hai. Không ràng "đúng một" vì giai
   đoạn sau khi tạo job thì cả hai cùng có giá trị (request_id giữ làm dấu vết nguồn). */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Crit_job_or_request')
    ALTER TABLE dbo.EvaluationCriteria
        ADD CONSTRAINT CK_Crit_job_or_request
            CHECK (job_id IS NOT NULL OR request_id IS NOT NULL);
GO

/* ---------- 2) Dựng lại chỉ mục duy nhất cho CẢ HAI phía ---------- */

-- Phía job: y như V042, chỉ thêm điều kiện job_id IS NOT NULL (xem đầu file).
IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria') AND name = 'UQ_Crit_job_name_active')
    CREATE UNIQUE INDEX UQ_Crit_job_name_active
        ON dbo.EvaluationCriteria (job_id, name)
        WHERE active = 1 AND job_id IS NOT NULL;
GO

-- Phía yêu cầu: chỉ áp khi tiêu chí CHƯA chuyển sang job. Sau khi chuyển, ràng buộc
-- theo job ở trên đã lo — giữ cả hai cùng lúc thì một bộ tiêu chí bị ràng hai lần
-- không vì lý do gì.
IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria') AND name = 'UQ_Crit_request_name_active')
    CREATE UNIQUE INDEX UQ_Crit_request_name_active
        ON dbo.EvaluationCriteria (request_id, name)
        WHERE active = 1 AND request_id IS NOT NULL AND job_id IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria') AND name = 'IX_Crit_job')
    CREATE NONCLUSTERED INDEX IX_Crit_job ON dbo.EvaluationCriteria (job_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria') AND name = 'IX_Crit_request')
    CREATE NONCLUSTERED INDEX IX_Crit_request ON dbo.EvaluationCriteria (request_id);
GO

/* ---------- 3) CriteriaExtraction: hàng đợi bóc AI cũng nhận yêu cầu ---------- */

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.CriteriaExtraction')
      AND name = 'job_id' AND is_nullable = 0
)
BEGIN
    ALTER TABLE dbo.CriteriaExtraction ALTER COLUMN job_id BIGINT NULL;
    PRINT N'V056: CriteriaExtraction.job_id -> NULL được.';
END
GO

IF COL_LENGTH('dbo.CriteriaExtraction', 'request_id') IS NULL
    ALTER TABLE dbo.CriteriaExtraction ADD request_id BIGINT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_CritExtract_Request')
    ALTER TABLE dbo.CriteriaExtraction
        ADD CONSTRAINT FK_CritExtract_Request FOREIGN KEY (request_id)
            REFERENCES dbo.RecruitmentRequest(request_id);
GO

/* Một lượt bóc thuộc về ĐÚNG MỘT trong hai — khác EvaluationCriteria ở trên, vì lượt
   bóc là một sự kiện tại một thời điểm, không đi qua hai giai đoạn. */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CritExtract_job_xor_request')
    ALTER TABLE dbo.CriteriaExtraction
        ADD CONSTRAINT CK_CritExtract_job_xor_request
            CHECK ((CASE WHEN job_id IS NULL THEN 0 ELSE 1 END)
                 + (CASE WHEN request_id IS NULL THEN 0 ELSE 1 END) = 1);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.CriteriaExtraction') AND name = 'IX_CritExtract_request')
    CREATE NONCLUSTERED INDEX IX_CritExtract_request ON dbo.CriteriaExtraction (request_id);
GO

PRINT N'V056 xong: tiêu chí và hàng đợi bóc AI gắn được vào Yêu cầu tuyển dụng.';
GO
