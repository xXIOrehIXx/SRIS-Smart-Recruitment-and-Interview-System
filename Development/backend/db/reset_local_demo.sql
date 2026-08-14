/* =============================================================================
   DỌN DB LOCAL VỀ 1 CÔNG TY DEMO SẠCH  (chỉ chạy trên máy dev — KHÔNG chạy trên DB team)

   Làm gì:
     1. Xoá TOÀN BỘ dữ liệu nghiệp vụ của mọi tenant (job, ứng viên, CV, lịch phỏng vấn,
        phiếu chấm, offer, magic link, log…) — dữ liệu rác tích tụ do test tự động.
     2. Xoá các công ty test tự sinh (Guard Test / PastTime / Items23 / Pct / Sotatek Demo…),
        chỉ giữ @KeepCompanyId.
     3. Giữ lại các tài khoản đăng nhập trong @KeepCompanyId liệt kê ở @KeepEmails,
        kéo tài khoản cá nhân ở tenant khác về công ty giữ lại.
     4. Đặt lại thông tin công ty (tên/địa chỉ/liên hệ/phúc lợi mặc định) cho đẹp khi demo
        — các mục này in thẳng vào thư mời nhận việc.

   Chạy (BẮT BUỘC có -f 65001, nếu không sqlcmd đọc file UTF-8 theo bảng mã ANSI và
   mọi chuỗi tiếng Việt trong script sẽ vào DB ở dạng "CÃ´ng ty..."):
     sqlcmd -S localhost -E -d SRIS -C -I -f 65001 -i db/reset_local_demo.sql

   Chạy xong thì seed lại bằng:  python tools/seed_demo_full.py --admin <email> --pass <pass>

   RLS bị tắt trong lúc dọn (script chạy ngoài request nên không có SESSION_CONTEXT),
   bật lại ở cuối kể cả khi lỗi.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @KeepCompanyId BIGINT = 1;

-- Email được giữ lại (trong công ty giữ lại HOẶC kéo từ tenant khác về).
DECLARE @KeepEmails TABLE (email NVARCHAR(256) PRIMARY KEY);
INSERT INTO @KeepEmails (email) VALUES
    (N'admin@test.com'),                -- Admin chính vẫn dùng để đăng nhập
    (N'giakhanh123@gmail.com'),         -- tài khoản cá nhân (đang ở tenant riêng, kéo về)
    (N'khanhvghe170815@fpt.edu.vn');    -- tài khoản cá nhân (DepartmentManager)

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);

BEGIN TRY
    BEGIN TRAN;

    /* ---------- 1) Dữ liệu nghiệp vụ: xoá sạch, con trước cha sau ---------- */
    DELETE FROM dbo.InterviewScore;
    DELETE FROM dbo.InterviewFeedback;
    UPDATE dbo.InterviewSchedule SET confirmed_slot_id = NULL;
    UPDATE dbo.InterviewSlot SET booked_application_id = NULL;
    DELETE FROM dbo.InterviewSlotInterviewer;
    DELETE FROM dbo.InterviewSchedule;
    DELETE FROM dbo.InterviewSlot;
    DELETE FROM dbo.InterviewSlotPool;

    DELETE FROM dbo.MagicLinkToken;
    DELETE FROM dbo.ActivityLog;
    DELETE FROM dbo.EmailLog;
    DELETE FROM dbo.InternalNote;
    DELETE FROM dbo.OfferDetail;
    DELETE FROM dbo.Application;

    DELETE FROM dbo.CvDocument;
    DELETE FROM dbo.Candidate;

    DELETE FROM dbo.EvaluationCriteria;
    DELETE FROM dbo.CriteriaExtraction;
    DELETE FROM dbo.JobBenefit;
    DELETE FROM dbo.JobRequirement;
    DELETE FROM dbo.RecruitmentRequest;
    DELETE FROM dbo.Job;

    -- Phòng ban xoá hết để seeder dựng lại đúng bộ 6 phòng (kèm DM phụ trách).
    DELETE FROM dbo.CriteriaTemplateItem;
    DELETE FROM dbo.CriteriaTemplate;
    DELETE FROM dbo.Department;

    /* ---------- 2) Tài khoản: kéo tài khoản cá nhân về công ty giữ lại ---------- */
    UPDATE dbo.[User]
       SET company_id = @KeepCompanyId
     WHERE email IN (SELECT email FROM @KeepEmails)
       AND company_id <> @KeepCompanyId;

    -- Token đăng nhập: xoá hết (UserAuthToken còn khoá ngoại sang Company nên phải sạch
    -- trước khi xoá tenant rác). Hệ quả duy nhất: mọi phiên đang mở phải đăng nhập lại.
    DELETE FROM dbo.UserAuthToken;
    DELETE FROM dbo.[User]
     WHERE email NOT IN (SELECT email FROM @KeepEmails);

    -- Tên hiển thị cho tài khoản còn lại (cột full_name trống -> UI hiện email).
    UPDATE dbo.[User] SET full_name = N'Vũ Gia Khánh'
     WHERE full_name IS NULL OR LTRIM(RTRIM(full_name)) = N'';

    /* ---------- 3) Công ty rác ---------- */
    DELETE FROM dbo.EmailTemplate  WHERE company_id <> @KeepCompanyId;
    DELETE FROM dbo.EmploymentType WHERE company_id <> @KeepCompanyId;
    DELETE FROM dbo.Company        WHERE company_id <> @KeepCompanyId;

    /* ---------- 4) Hồ sơ công ty demo ---------- */
    UPDATE dbo.Company
       SET name           = N'Công ty Cổ phần Công nghệ SRIS',
           address        = N'Tầng 8, Toà nhà Sông Đà, 131 Trần Phú, Hà Đông, Hà Nội',
           contact_email  = N'tuyendung@sris.vn',
           phone          = N'024 6666 8888',
           primary_color  = COALESCE(primary_color, N'#2563EB'),
           default_benefits = N'Lương tháng 13 và thưởng theo hiệu quả công việc' + CHAR(10)
                            + N'Bảo hiểm sức khoẻ cho nhân viên chính thức' + CHAR(10)
                            + N'12 ngày phép/năm, xét tăng lương 1 lần/năm' + CHAR(10)
                            + N'Team building 2 lần/năm, du lịch hè',
           updated_at     = SYSUTCDATETIME()
     WHERE company_id = @KeepCompanyId;

    -- Danh mục loại hình làm việc (dropdown khi tạo tin) — bù nếu thiếu.
    INSERT INTO dbo.EmploymentType (company_id, name, status, created_at)
    SELECT @KeepCompanyId, v.name, 'Active', SYSUTCDATETIME()
      FROM (VALUES (N'Toàn thời gian'), (N'Bán thời gian'), (N'Hợp đồng'),
                   (N'Thực tập'), (N'Làm việc từ xa')) AS v(name)
     WHERE NOT EXISTS (SELECT 1 FROM dbo.EmploymentType e
                        WHERE e.company_id = @KeepCompanyId AND e.name = v.name);

    COMMIT;

    SELECT company_id, name, slug FROM dbo.Company;
    SELECT user_id, email, role, full_name, company_id FROM dbo.[User] ORDER BY user_id;
    SELECT (SELECT COUNT(*) FROM dbo.Job) AS Jobs,
           (SELECT COUNT(*) FROM dbo.Application) AS Applications,
           (SELECT COUNT(*) FROM dbo.Candidate) AS Candidates;
    PRINT N'DỌN XONG DB LOCAL.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    PRINT N'LỖI: ' + ERROR_MESSAGE();
END CATCH

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
