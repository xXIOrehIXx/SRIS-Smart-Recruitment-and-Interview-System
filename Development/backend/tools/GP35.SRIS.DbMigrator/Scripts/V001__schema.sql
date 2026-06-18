/* =============================================================================
   SRIS — Smart Recruitment and Interview System
   Database schema for SQL Server 2025 (compatibility level 170)
   Dựng theo ERD hiện tại (21 thực thể).

   Quy ước:
   - PK: BIGINT IDENTITY(1,1).
   - Mọi bảng có company_id (FK -> Company) phục vụ cô lập tenant + RLS.
   - Text tiếng Việt dùng NVARCHAR.
   - Thời gian dùng DATETIME2 lưu giờ UTC (SYSUTCDATETIME()).
   - Các trường enum ràng buộc bằng CHECK constraint (mã hóa luôn quyết định thiết kế).
   - FK để NO ACTION (không cascade) để tránh lỗi multiple cascade paths;
     xóa dữ liệu xử lý ở tầng ứng dụng (hoặc dùng soft-delete).
   - Vector: cột VECTOR(384) — KHÔNG được DEFAULT/CHECK/UNIQUE/PK/FK (giới hạn của type).

   Ghi chú khác biệt nhỏ so với ERD (đã chủ đích):
   - InterviewScore thêm cột `note` (NVARCHAR) vì 5.7 yêu cầu note từng tiêu chí.
   - Mọi bảng thêm created_at; bảng entity hay đổi thêm updated_at (chuẩn audit).
   - "User" là từ khóa SQL Server -> bảng đặt tên [User] (bọc ngoặc vuông).

   LƯU Ý (Claude): file này là schema LOCAL người dùng đang chạy. Nó là bản RÚT GỌN
   so với DB remote + entities trong code (remote/entity có thêm: CvDocument.file_url/
   file_name/file_size/mime_type; Candidate.linkedin_url/current_position/years_experience;
   Job.department/location/employment_type/quantity/cv_score_threshold/created_by/closed_at).
   Khi cần cho tính năng CV-scoring + MinIO, xem db/migration_cv_scoring.sql.
   ============================================================================= */

/* -----------------------------------------------------------------------------
   0) Khởi tạo (tùy chọn — bỏ comment nếu cần tạo DB mới)
   ----------------------------------------------------------------------------- */
-- CREATE DATABASE SRIS;
-- GO
-- ALTER DATABASE SRIS SET COMPATIBILITY_LEVEL = 170;        -- SQL Server 2025
-- GO
-- ALTER DATABASE SCOPED CONFIGURATION SET PREVIEW_FEATURES = ON;  -- cần cho VECTOR INDEX / VECTOR_SEARCH
-- GO
-- USE SRIS;
-- GO

/* =============================================================================
   1) BẢNG
   Thứ tự tạo theo phụ thuộc khóa ngoại (cha trước, con sau).
   ============================================================================= */

/* ---------- Cụm 1: tenant & người dùng ---------- */

CREATE TABLE dbo.Company (
    company_id      BIGINT IDENTITY(1,1) NOT NULL,
    name            NVARCHAR(200)        NOT NULL,
    slug            VARCHAR(100)         NOT NULL,
    logo_url        NVARCHAR(500)        NULL,
    primary_color   VARCHAR(20)          NULL,
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Company_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_Company       PRIMARY KEY (company_id),
    CONSTRAINT UQ_Company_slug  UNIQUE (slug)
);
GO

-- [User]: 4 role đăng nhập Portal — Admin, Recruiter, Interviewer, Department Manager.
-- Chỉ Candidate dùng magic link (không phải User).
CREATE TABLE dbo.[User] (
    user_id         BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    email           NVARCHAR(256)        NOT NULL,
    password_hash   NVARCHAR(256)        NOT NULL,
    role            VARCHAR(20)          NOT NULL,
    status          VARCHAR(20)          NOT NULL CONSTRAINT DF_User_status DEFAULT 'Active',
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_User_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_User        PRIMARY KEY (user_id),
    CONSTRAINT FK_User_Company FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
    CONSTRAINT UQ_User_company_email UNIQUE (company_id, email),
    CONSTRAINT CK_User_role   CHECK (role   IN ('Admin','Recruiter','Interviewer','DepartmentManager')),
    CONSTRAINT CK_User_status CHECK (status IN ('Active','Disabled'))
);
GO

/* ---------- Cụm 2: lõi tuyển dụng ---------- */

CREATE TABLE dbo.Job (
    job_id                BIGINT IDENTITY(1,1) NOT NULL,
    company_id            BIGINT               NOT NULL,
    title                 NVARCHAR(300)        NOT NULL,
    jd_text               NVARCHAR(MAX)        NULL,
    embedding             VECTOR(384)          NULL,     -- JD đã vector hóa (so với CV)
    department_manager_id BIGINT               NULL,     -- người quyết tuyển (Department Manager); NULL = Recruiter quyết
    created_by            BIGINT               NULL,     -- Recruiter mở job (người tạo)
    status                VARCHAR(20)          NOT NULL CONSTRAINT DF_Job_status DEFAULT 'Draft',
    created_at            DATETIME2(3)         NOT NULL CONSTRAINT DF_Job_created DEFAULT SYSUTCDATETIME(),
    updated_at            DATETIME2(3)         NULL,
    CONSTRAINT PK_Job        PRIMARY KEY (job_id),
    CONSTRAINT FK_Job_Company     FOREIGN KEY (company_id)            REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Job_DeptManager FOREIGN KEY (department_manager_id) REFERENCES dbo.[User](user_id),
    CONSTRAINT FK_Job_CreatedBy   FOREIGN KEY (created_by)            REFERENCES dbo.[User](user_id),
    CONSTRAINT CK_Job_status CHECK (status IN ('Draft','Open','Closed'))
);
GO

CREATE TABLE dbo.Candidate (
    candidate_id    BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    full_name       NVARCHAR(200)        NOT NULL,
    email           NVARCHAR(256)        NOT NULL,
    phone           VARCHAR(30)          NULL,
    source          NVARCHAR(50)         NULL,     -- kênh đến: Career Site / TopCV / VietnamWorks / Referral...
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Candidate_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_Candidate        PRIMARY KEY (candidate_id),
    CONSTRAINT FK_Candidate_Company FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
    CONSTRAINT UQ_Candidate_company_email UNIQUE (company_id, email)
);
GO

CREATE TABLE dbo.CvDocument (
    cv_id           BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    candidate_id    BIGINT               NOT NULL,
    extracted_text  NVARCHAR(MAX)        NULL,
    embedding       VECTOR(384)          NULL,     -- CV đã vector hóa
    parse_status    VARCHAR(20)          NOT NULL CONSTRAINT DF_Cv_parse DEFAULT 'OK',
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Cv_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_CvDocument          PRIMARY KEY (cv_id),
    CONSTRAINT FK_Cv_Company          FOREIGN KEY (company_id)   REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Cv_Candidate        FOREIGN KEY (candidate_id) REFERENCES dbo.Candidate(candidate_id),
    CONSTRAINT CK_Cv_parse_status     CHECK (parse_status IN ('OK','FAILED'))  -- FAILED = reject, không có luồng sửa tay
);
GO

CREATE TABLE dbo.Application (
    application_id  BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    job_id          BIGINT               NOT NULL,
    candidate_id    BIGINT               NOT NULL,
    cv_id           BIGINT               NOT NULL,
    current_state   VARCHAR(20)          NOT NULL CONSTRAINT DF_App_state DEFAULT 'NEW',
    ai_match_score  DECIMAL(6,2)         NULL,     -- điểm khớp CV-JD của đúng cặp này
    reject_reason   NVARCHAR(300)        NULL,     -- lý do loại nội bộ, 1-chạm (chip preset)
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_App_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_Application       PRIMARY KEY (application_id),
    CONSTRAINT FK_App_Company       FOREIGN KEY (company_id)   REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_App_Job           FOREIGN KEY (job_id)       REFERENCES dbo.Job(job_id),
    CONSTRAINT FK_App_Candidate     FOREIGN KEY (candidate_id) REFERENCES dbo.Candidate(candidate_id),
    CONSTRAINT FK_App_Cv            FOREIGN KEY (cv_id)        REFERENCES dbo.CvDocument(cv_id),
    CONSTRAINT CK_App_state CHECK (current_state IN
        ('NEW','SCREENING','QUIZ','INTERVIEW','OFFER','HIRED','REJECTED'))
);
GO

/* ---------- Cụm 3: cấu hình theo job ---------- */

CREATE TABLE dbo.EvaluationCriteria (
    criteria_id     BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    job_id          BIGINT               NOT NULL,  -- tiêu chí PER-JOB
    name            NVARCHAR(150)        NOT NULL,
    weight          DECIMAL(6,2)         NOT NULL CONSTRAINT DF_Crit_weight DEFAULT 1,    -- trọng số (quan trọng gấp mấy lần)
    max_score       DECIMAL(6,2)         NOT NULL CONSTRAINT DF_Crit_max DEFAULT 10,
    active          BIT                  NOT NULL CONSTRAINT DF_Crit_active DEFAULT 1,
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Crit_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_EvaluationCriteria PRIMARY KEY (criteria_id),
    CONSTRAINT FK_Crit_Company       FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Crit_Job           FOREIGN KEY (job_id)     REFERENCES dbo.Job(job_id),
    CONSTRAINT UQ_Crit_job_name      UNIQUE (job_id, name)
);
GO

/* ---------- Cụm 6: offer (đặt sớm vì Application đã tồn tại) ---------- */

CREATE TABLE dbo.OfferDetail (
    offer_id        BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    application_id  BIGINT               NOT NULL,
    salary_amount   DECIMAL(18,2)        NULL,
    currency        CHAR(3)              NOT NULL CONSTRAINT DF_Offer_ccy DEFAULT 'VND',
    start_date      DATE                 NULL,
    status          VARCHAR(20)          NOT NULL CONSTRAINT DF_Offer_status DEFAULT 'PENDING',
    sent_at         DATETIME2(3)         NULL,
    responded_at    DATETIME2(3)         NULL,
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Offer_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_OfferDetail        PRIMARY KEY (offer_id),
    CONSTRAINT FK_Offer_Company      FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Offer_Application  FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
    CONSTRAINT UQ_Offer_application  UNIQUE (application_id),     -- 0..1 offer / application
    CONSTRAINT CK_Offer_status       CHECK (status IN ('PENDING','ACCEPTED','DECLINED'))
);
GO

/* ---------- Cụm 7: hạ tầng vận hành ---------- */

-- MagicLinkToken: 4 purpose, TẤT CẢ của ứng viên (người trong cuộc đã login Portal).
CREATE TABLE dbo.MagicLinkToken (
    token_id        BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    application_id  BIGINT               NOT NULL,  -- token luôn gắn 1 hồ sơ ứng viên
    token_hash      CHAR(64)             NOT NULL,  -- SHA-256 hex; KHÔNG lưu token gốc
    purpose         VARCHAR(20)          NOT NULL,
    expires_at      DATETIME2(3)         NOT NULL,
    used_at         DATETIME2(3)         NULL,      -- đốt khi GỬI, không phải khi mở
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Token_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_MagicLinkToken        PRIMARY KEY (token_id),
    CONSTRAINT FK_Token_Company         FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Token_Application     FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
    CONSTRAINT UQ_Token_hash            UNIQUE (token_hash),
    CONSTRAINT CK_Token_purpose CHECK (purpose IN
        ('QUIZ','SCHEDULE','STATUS','OFFER_RESPONSE'))
);
GO

-- ActivityLog: hệ thống tự ghi (append-only), audit trail.
CREATE TABLE dbo.ActivityLog (
    log_id          BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    application_id  BIGINT               NOT NULL,
    user_id         BIGINT               NULL,     -- NULL = hành động do hệ thống
    action          NVARCHAR(150)        NOT NULL,
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Log_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_ActivityLog       PRIMARY KEY (log_id),
    CONSTRAINT FK_Log_Company       FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Log_Application   FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
    CONSTRAINT FK_Log_User          FOREIGN KEY (user_id)        REFERENCES dbo.[User](user_id)
);
GO

-- InternalNote: HR gõ tay, nội bộ, KHÔNG gửi ứng viên.
CREATE TABLE dbo.InternalNote (
    note_id         BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    application_id  BIGINT               NOT NULL,
    user_id         BIGINT               NOT NULL,
    content         NVARCHAR(MAX)        NOT NULL,
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Note_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_InternalNote       PRIMARY KEY (note_id),
    CONSTRAINT FK_Note_Company       FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Note_Application   FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
    CONSTRAINT FK_Note_User          FOREIGN KEY (user_id)        REFERENCES dbo.[User](user_id)
);
GO

CREATE TABLE dbo.EmailTemplate (
    template_id     BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    type            NVARCHAR(50)         NOT NULL,  -- loại email, trigger theo state machine
    subject         NVARCHAR(300)        NOT NULL,
    body            NVARCHAR(MAX)        NOT NULL,
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Tmpl_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_EmailTemplate      PRIMARY KEY (template_id),
    CONSTRAINT FK_Tmpl_Company       FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id)
);
GO

CREATE TABLE dbo.EmailLog (
    email_id        BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    application_id  BIGINT               NOT NULL,
    template_id     BIGINT               NULL,
    status          VARCHAR(20)          NOT NULL CONSTRAINT DF_Email_status DEFAULT 'PENDING',
    sent_at         DATETIME2(3)         NULL,
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Email_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_EmailLog           PRIMARY KEY (email_id),
    CONSTRAINT FK_Email_Company      FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Email_Application  FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
    CONSTRAINT FK_Email_Template     FOREIGN KEY (template_id)    REFERENCES dbo.EmailTemplate(template_id),
    CONSTRAINT CK_Email_status       CHECK (status IN ('PENDING','SENT','FAILED'))
);
GO

/* ---------- Cụm 4: quiz ---------- */

CREATE TABLE dbo.Quiz (
    quiz_id         BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    job_id          BIGINT               NOT NULL,
    type            VARCHAR(20)          NOT NULL CONSTRAINT DF_Quiz_type DEFAULT 'MCQ',
    duration_min    INT                  NULL,
    generated_by_ai BIT                  NOT NULL CONSTRAINT DF_Quiz_ai DEFAULT 0,
    status          VARCHAR(20)          NOT NULL CONSTRAINT DF_Quiz_status DEFAULT 'DRAFT',
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Quiz_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_Quiz        PRIMARY KEY (quiz_id),
    CONSTRAINT FK_Quiz_Company FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Quiz_Job     FOREIGN KEY (job_id)     REFERENCES dbo.Job(job_id),
    CONSTRAINT CK_Quiz_type    CHECK (type IN ('MCQ')),                 -- MCQ-only
    CONSTRAINT CK_Quiz_status  CHECK (status IN ('DRAFT','READY'))      -- AI gen -> DRAFT -> HR duyệt -> READY
);
GO

CREATE TABLE dbo.QuizQuestion (
    question_id     BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    quiz_id         BIGINT               NOT NULL,
    content         NVARCHAR(MAX)        NOT NULL,
    options_json    NVARCHAR(MAX)        NOT NULL,  -- 4 lựa chọn dạng JSON
    correct_option  NVARCHAR(50)         NOT NULL,  -- nhãn đáp án đúng (vd 'A')
    points          INT                  NOT NULL CONSTRAINT DF_QQ_points DEFAULT 1,
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_QQ_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_QuizQuestion       PRIMARY KEY (question_id),
    CONSTRAINT FK_QQ_Company         FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_QQ_Quiz            FOREIGN KEY (quiz_id)    REFERENCES dbo.Quiz(quiz_id),
    CONSTRAINT CK_QQ_options_json    CHECK (ISJSON(options_json) = 1)
);
GO

CREATE TABLE dbo.QuizAttempt (
    attempt_id      BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    application_id  BIGINT               NOT NULL,
    quiz_id         BIGINT               NOT NULL,
    started_at      DATETIME2(3)         NULL,
    submitted_at    DATETIME2(3)         NULL,      -- NULL = đang làm
    score           DECIMAL(6,2)         NULL,
    risk_score      INT                  NOT NULL CONSTRAINT DF_QA_risk DEFAULT 0,  -- tổng dồn từ AntiCheatEvent
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_QA_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_QuizAttempt        PRIMARY KEY (attempt_id),
    CONSTRAINT FK_QA_Company         FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_QA_Application     FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
    CONSTRAINT FK_QA_Quiz            FOREIGN KEY (quiz_id)        REFERENCES dbo.Quiz(quiz_id)
);
GO

CREATE TABLE dbo.QuizAnswer (
    answer_id       BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,  -- thêm để RLS đồng nhất per-table
    attempt_id      BIGINT               NOT NULL,
    question_id     BIGINT               NOT NULL,
    selected_option NVARCHAR(50)         NULL,
    is_correct      BIT                  NULL,
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_QAns_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_QuizAnswer         PRIMARY KEY (answer_id),
    CONSTRAINT FK_QAns_Company       FOREIGN KEY (company_id)  REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_QAns_Attempt       FOREIGN KEY (attempt_id)  REFERENCES dbo.QuizAttempt(attempt_id),
    CONSTRAINT FK_QAns_Question      FOREIGN KEY (question_id) REFERENCES dbo.QuizQuestion(question_id),
    CONSTRAINT UQ_QAns_attempt_q     UNIQUE (attempt_id, question_id)
);
GO

CREATE TABLE dbo.AntiCheatEvent (
    event_id        BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,  -- thêm để RLS đồng nhất per-table
    attempt_id      BIGINT               NOT NULL,
    event_type      VARCHAR(30)          NOT NULL,
    occurred_at     DATETIME2(3)         NOT NULL CONSTRAINT DF_ACE_occurred DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_AntiCheatEvent     PRIMARY KEY (event_id),
    CONSTRAINT FK_ACE_Company        FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_ACE_Attempt        FOREIGN KEY (attempt_id) REFERENCES dbo.QuizAttempt(attempt_id),
    CONSTRAINT CK_ACE_event_type     CHECK (event_type IN
        ('TAB_SWITCH','BLUR','DISCONNECT','MULTI_MONITOR','FULLSCREEN_EXIT'))
);
GO

/* ---------- Cụm 5: phỏng vấn & chấm điểm ----------
   Lưu ý: InterviewSchedule.confirmed_slot_id <-> InterviewSlot.schedule_id là FK vòng.
   Tạo Schedule trước (chưa gắn FK confirmed_slot), tạo Slot, rồi ALTER thêm FK. */

CREATE TABLE dbo.InterviewSchedule (
    schedule_id       BIGINT IDENTITY(1,1) NOT NULL,
    company_id        BIGINT               NOT NULL,
    application_id    BIGINT               NOT NULL,
    round_number      INT                  NOT NULL CONSTRAINT DF_Sched_round DEFAULT 1,  -- nhiều vòng = dữ liệu, không thêm state
    status            VARCHAR(20)          NOT NULL CONSTRAINT DF_Sched_status DEFAULT 'PENDING',
    confirmed_slot_id BIGINT               NULL,
    created_at        DATETIME2(3)         NOT NULL CONSTRAINT DF_Sched_created DEFAULT SYSUTCDATETIME(),
    updated_at        DATETIME2(3)         NULL,
    CONSTRAINT PK_InterviewSchedule   PRIMARY KEY (schedule_id),
    CONSTRAINT FK_Sched_Company       FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Sched_Application   FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
    CONSTRAINT CK_Sched_status        CHECK (status IN ('PENDING','CONFIRMED','NO_SLOT_FITS','CANCELLED'))
);
GO

CREATE TABLE dbo.InterviewSlot (
    slot_id         BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    schedule_id     BIGINT               NOT NULL,
    interviewer_id  BIGINT               NOT NULL,
    start_time      DATETIME2(3)         NOT NULL,
    status          VARCHAR(20)          NOT NULL CONSTRAINT DF_Slot_status DEFAULT 'OPEN',
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Slot_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,
    CONSTRAINT PK_InterviewSlot      PRIMARY KEY (slot_id),
    CONSTRAINT FK_Slot_Company       FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Slot_Schedule      FOREIGN KEY (schedule_id)    REFERENCES dbo.InterviewSchedule(schedule_id),
    CONSTRAINT FK_Slot_Interviewer   FOREIGN KEY (interviewer_id) REFERENCES dbo.[User](user_id),
    CONSTRAINT CK_Slot_status        CHECK (status IN ('OPEN','BOOKED','LOCKED'))
);
GO

-- Thêm FK vòng còn lại sau khi InterviewSlot tồn tại.
ALTER TABLE dbo.InterviewSchedule
    ADD CONSTRAINT FK_Sched_ConfirmedSlot
    FOREIGN KEY (confirmed_slot_id) REFERENCES dbo.InterviewSlot(slot_id);
GO

CREATE TABLE dbo.InterviewScore (
    score_id        BIGINT IDENTITY(1,1) NOT NULL,
    company_id      BIGINT               NOT NULL,
    schedule_id     BIGINT               NOT NULL,
    interviewer_id  BIGINT               NOT NULL,
    criteria_id     BIGINT               NOT NULL,
    score           DECIMAL(6,2)         NULL,      -- NULL khi còn nháp
    note            NVARCHAR(MAX)        NULL,      -- note từng tiêu chí (thêm so với ERD theo 5.7)
    status          VARCHAR(20)          NOT NULL CONSTRAINT DF_Score_status DEFAULT 'DRAFT',
    created_at      DATETIME2(3)         NOT NULL CONSTRAINT DF_Score_created DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2(3)         NULL,      -- nháp tự lưu server cập nhật cột này
    CONSTRAINT PK_InterviewScore     PRIMARY KEY (score_id),
    CONSTRAINT FK_Score_Company      FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
    CONSTRAINT FK_Score_Schedule     FOREIGN KEY (schedule_id)    REFERENCES dbo.InterviewSchedule(schedule_id),
    CONSTRAINT FK_Score_Interviewer  FOREIGN KEY (interviewer_id) REFERENCES dbo.[User](user_id),
    CONSTRAINT FK_Score_Criteria     FOREIGN KEY (criteria_id)    REFERENCES dbo.EvaluationCriteria(criteria_id),
    CONSTRAINT UQ_Score_unique       UNIQUE (schedule_id, interviewer_id, criteria_id),  -- 1 phiếu / người / tiêu chí / buổi
    CONSTRAINT CK_Score_status       CHECK (status IN ('DRAFT','SUBMITTED'))             -- Blind Review: ẩn tới khi SUBMITTED
);
GO

/* =============================================================================
   2) CHỈ MỤC (index) — SQL Server không tự tạo index cho FK.
   ============================================================================= */

-- company_id (lọc tenant) trên mọi bảng con
CREATE NONCLUSTERED INDEX IX_User_company         ON dbo.[User](company_id);
CREATE NONCLUSTERED INDEX IX_Job_company          ON dbo.Job(company_id);
CREATE NONCLUSTERED INDEX IX_Candidate_company    ON dbo.Candidate(company_id);
CREATE NONCLUSTERED INDEX IX_Cv_company           ON dbo.CvDocument(company_id);
CREATE NONCLUSTERED INDEX IX_App_company          ON dbo.Application(company_id);
CREATE NONCLUSTERED INDEX IX_Crit_company         ON dbo.EvaluationCriteria(company_id);
CREATE NONCLUSTERED INDEX IX_Offer_company        ON dbo.OfferDetail(company_id);
CREATE NONCLUSTERED INDEX IX_Token_company        ON dbo.MagicLinkToken(company_id);
CREATE NONCLUSTERED INDEX IX_Log_company          ON dbo.ActivityLog(company_id);
CREATE NONCLUSTERED INDEX IX_Note_company         ON dbo.InternalNote(company_id);
CREATE NONCLUSTERED INDEX IX_Tmpl_company         ON dbo.EmailTemplate(company_id);
CREATE NONCLUSTERED INDEX IX_Email_company        ON dbo.EmailLog(company_id);
CREATE NONCLUSTERED INDEX IX_Quiz_company         ON dbo.Quiz(company_id);
CREATE NONCLUSTERED INDEX IX_QQ_company           ON dbo.QuizQuestion(company_id);
CREATE NONCLUSTERED INDEX IX_QA_company           ON dbo.QuizAttempt(company_id);
CREATE NONCLUSTERED INDEX IX_QAns_company         ON dbo.QuizAnswer(company_id);
CREATE NONCLUSTERED INDEX IX_ACE_company          ON dbo.AntiCheatEvent(company_id);
CREATE NONCLUSTERED INDEX IX_Sched_company        ON dbo.InterviewSchedule(company_id);
CREATE NONCLUSTERED INDEX IX_Slot_company         ON dbo.InterviewSlot(company_id);
CREATE NONCLUSTERED INDEX IX_Score_company        ON dbo.InterviewScore(company_id);
GO

-- FK / lookup hay join
CREATE NONCLUSTERED INDEX IX_Cv_candidate      ON dbo.CvDocument(candidate_id);
CREATE NONCLUSTERED INDEX IX_App_job           ON dbo.Application(job_id);
CREATE NONCLUSTERED INDEX IX_App_candidate     ON dbo.Application(candidate_id);
CREATE NONCLUSTERED INDEX IX_App_cv            ON dbo.Application(cv_id);
CREATE NONCLUSTERED INDEX IX_App_state         ON dbo.Application(current_state);
CREATE NONCLUSTERED INDEX IX_Crit_job          ON dbo.EvaluationCriteria(job_id);
CREATE NONCLUSTERED INDEX IX_Job_deptmgr       ON dbo.Job(department_manager_id);
CREATE NONCLUSTERED INDEX IX_Token_app         ON dbo.MagicLinkToken(application_id);
CREATE NONCLUSTERED INDEX IX_Log_app           ON dbo.ActivityLog(application_id);
CREATE NONCLUSTERED INDEX IX_Note_app          ON dbo.InternalNote(application_id);
CREATE NONCLUSTERED INDEX IX_Email_app         ON dbo.EmailLog(application_id);
CREATE NONCLUSTERED INDEX IX_Quiz_job          ON dbo.Quiz(job_id);
CREATE NONCLUSTERED INDEX IX_QQ_quiz           ON dbo.QuizQuestion(quiz_id);
CREATE NONCLUSTERED INDEX IX_QA_app            ON dbo.QuizAttempt(application_id);
CREATE NONCLUSTERED INDEX IX_QA_quiz           ON dbo.QuizAttempt(quiz_id);
CREATE NONCLUSTERED INDEX IX_QAns_attempt      ON dbo.QuizAnswer(attempt_id);
CREATE NONCLUSTERED INDEX IX_ACE_attempt       ON dbo.AntiCheatEvent(attempt_id);
CREATE NONCLUSTERED INDEX IX_Sched_app         ON dbo.InterviewSchedule(application_id);
CREATE NONCLUSTERED INDEX IX_Slot_schedule     ON dbo.InterviewSlot(schedule_id);
CREATE NONCLUSTERED INDEX IX_Slot_interviewer  ON dbo.InterviewSlot(interviewer_id);
CREATE NONCLUSTERED INDEX IX_Score_schedule    ON dbo.InterviewScore(schedule_id);
CREATE NONCLUSTERED INDEX IX_Score_interviewer ON dbo.InterviewScore(interviewer_id);
GO

/* =============================================================================
   3) (TÙY CHỌN) VECTOR INDEX — tăng tốc tìm kiếm tương đồng CV/JD.
   Yêu cầu: PREVIEW_FEATURES = ON và bảng có >= 100 dòng.
   Nếu KHÔNG tạo, vẫn chấm điểm được bằng VECTOR_DISTANCE('cosine', a, b) (brute-force kNN).
   Bỏ comment khi đã có đủ dữ liệu:
   -----------------------------------------------------------------------------
-- CREATE VECTOR INDEX VX_Cv_embedding  ON dbo.CvDocument(embedding) WITH (METRIC = 'cosine', TYPE = 'diskann');
-- CREATE VECTOR INDEX VX_Job_embedding ON dbo.Job(embedding)        WITH (METRIC = 'cosine', TYPE = 'diskann');
   ============================================================================= */

/* =============================================================================
   4) (TÙY CHỌN) ROW-LEVEL SECURITY — cô lập tenant ở tầng DB.
   Ứng dụng PHẢI set SESSION_CONTEXT('CompanyId') đầu mỗi request (chú ý connection pooling).
   Predicate FILTER (ẩn dòng khác tenant khi đọc) + BLOCK (chặn ghi sai tenant).
   ============================================================================= */

CREATE FUNCTION dbo.fn_TenantPredicate(@company_id BIGINT)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
    SELECT 1 AS allowed
    WHERE @company_id = CAST(SESSION_CONTEXT(N'CompanyId') AS BIGINT);
GO

CREATE SECURITY POLICY dbo.TenantSecurityPolicy
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.[User],
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.[User],
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Job,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Job,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Candidate,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Candidate,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.CvDocument,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.CvDocument,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Application,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Application,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.EvaluationCriteria,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.EvaluationCriteria,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.OfferDetail,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.OfferDetail,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.MagicLinkToken,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.MagicLinkToken,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.ActivityLog,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.ActivityLog,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InternalNote,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InternalNote,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.EmailTemplate,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.EmailTemplate,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.EmailLog,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.EmailLog,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Quiz,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.Quiz,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.QuizQuestion,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.QuizQuestion,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.QuizAttempt,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.QuizAttempt,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.QuizAnswer,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.QuizAnswer,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.AntiCheatEvent,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.AntiCheatEvent,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewSchedule,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewSchedule,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewSlot,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewSlot,
    ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewScore,
    ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.InterviewScore
    WITH (STATE = ON);
GO

/* =============================================================================
   Cách set tenant cho mỗi request (ứng dụng gọi sau khi mở connection):
   EXEC sp_set_session_context @key = N'CompanyId', @value = <company_id_đăng_nhập>;
   (App tự làm trong ConnectionManager.GetDbConnectionAsync — xem code .NET.)
   ============================================================================= */
