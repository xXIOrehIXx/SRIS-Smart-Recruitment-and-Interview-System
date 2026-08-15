/* =============================================================================
   MIGRATION V043 — Role GIÁM ĐỐC + phiếu Đề xuất tuyển (chốt 15/08/2026).

   Hội đồng chốt: Trưởng bộ phận KHÔNG đủ thẩm quyền tuyển. DM chỉ ĐỀ XUẤT
   "nên tuyển người này"; Giám đốc mới quyết tuyển và chốt điều khoản (mức lương,
   ngày vào làm) để bộ phận nhân sự soạn thư mời.

   Hai thứ trong migration này:
     1. role 'Director' vào CHECK constraint User.role (role thứ 5 đăng nhập Portal).
     2. Bảng HiringProposal — đối xứng với RecruitmentRequest (V019): ở đầu quy trình
        DM ra đề rồi nhân sự duyệt; ở cuối quy trình DM đề xuất rồi Giám đốc duyệt.

   Trạng thái: PENDING -> APPROVED (Giám đốc duyệt -> hồ sơ sang OFFER)
                       -> REJECTED (Giám đốc không duyệt; hồ sơ Ở LẠI bước Phỏng vấn,
                                    DM đề xuất lại được sau khi bổ sung căn cứ)
   Idempotent.
   ============================================================================= */

/* ---------- 1) Role Director ---------- */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_User_role')
BEGIN
    ALTER TABLE dbo.[User] DROP CONSTRAINT CK_User_role;
    ALTER TABLE dbo.[User] ADD CONSTRAINT CK_User_role
        CHECK (role IN ('Admin','Recruiter','Interviewer','DepartmentManager','Director'));
END
GO

/* ---------- 2) Phiếu đề xuất tuyển ---------- */
IF OBJECT_ID('dbo.HiringProposal', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.HiringProposal (
        proposal_id          BIGINT IDENTITY(1,1) NOT NULL,
        company_id           BIGINT               NOT NULL,
        application_id       BIGINT               NOT NULL,
        status               VARCHAR(20)          NOT NULL CONSTRAINT DF_HiringProp_status DEFAULT 'PENDING',

        -- Đề xuất của Trưởng bộ phận
        proposal_note        NVARCHAR(MAX)        NULL,   -- vì sao nên tuyển người này
        proposed_salary      DECIMAL(18,2)        NULL,
        proposed_start_date  DATETIME2(3)         NULL,
        created_by           BIGINT               NULL,   -- DM đề xuất
        created_at           DATETIME2(3)         NOT NULL CONSTRAINT DF_HiringProp_created DEFAULT SYSUTCDATETIME(),

        -- Quyết định của Giám đốc. approved_* là điều khoản CHỐT (có thể khác đề xuất)
        -- và là thứ bộ phận nhân sự lấy để soạn thư mời (docs 5.15).
        decision_note        NVARCHAR(MAX)        NULL,
        approved_salary      DECIMAL(18,2)        NULL,
        approved_start_date  DATETIME2(3)         NULL,
        decided_by           BIGINT               NULL,   -- Giám đốc
        decided_at           DATETIME2(3)         NULL,

        CONSTRAINT PK_HiringProposal PRIMARY KEY (proposal_id),
        CONSTRAINT FK_HiringProp_Company     FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_HiringProp_Application FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
        CONSTRAINT FK_HiringProp_CreatedBy   FOREIGN KEY (created_by)     REFERENCES dbo.[User](user_id),
        CONSTRAINT FK_HiringProp_DecidedBy   FOREIGN KEY (decided_by)     REFERENCES dbo.[User](user_id),
        CONSTRAINT CK_HiringProp_status CHECK (status IN ('PENDING','APPROVED','REJECTED'))
    );
    CREATE NONCLUSTERED INDEX IX_HiringProp_company ON dbo.HiringProposal(company_id);
    CREATE NONCLUSTERED INDEX IX_HiringProp_status  ON dbo.HiringProposal(company_id, status);
    CREATE NONCLUSTERED INDEX IX_HiringProp_app     ON dbo.HiringProposal(company_id, application_id);

    -- Một hồ sơ chỉ được có ĐÚNG MỘT đề xuất đang chờ. Đề xuất đã bị từ chối thì đề xuất
    -- lại được (lọc theo status) — nếu ràng buộc không lọc thì lần từ chối đầu tiên khoá
    -- luôn hồ sơ đó, đúng lỗi đã dính ở tiêu chí (V042).
    CREATE UNIQUE NONCLUSTERED INDEX UX_HiringProp_pending
        ON dbo.HiringProposal(company_id, application_id)
        WHERE status = 'PENDING';
END
GO

/* RLS: cô lập tenant như mọi bảng có company_id (coding rule #1). Idempotent. */
IF OBJECT_ID('dbo.TenantSecurityPolicy', 'SP') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.HiringProposal'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.HiringProposal,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.HiringProposal;
GO
