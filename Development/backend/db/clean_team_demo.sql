/* =============================================================================
   DỌN DB TEAM (SRIS_dev) TRƯỚC BUỔI DEMO

   Phạm vi: chỉ công ty @CompanyId. KHÔNG đụng schema, KHÔNG đụng tài khoản của
   đồng đội (trừ mấy user *.demo.vn do script seed cũ đẻ ra, và chỉ xoá khi không
   còn bản ghi nào tham chiếu).

   Làm gì:
     1. Xoá các tin tuyển dụng rác: JD rỗng/quá ngắn, tên "Test/Test 2/Test 3",
        và 2 lứa seed cũ [33d6e] / [79be5]  (danh sách ở @JunkJobs).
     2. Xoá TOÀN BỘ hồ sơ ứng viên hiện có của công ty — đều là dữ liệu bấm tay khi
        test FE ("Nguyễn Văn A", "Tran Ung Vien", 12 bản trùng "Tran Huy Minh"…),
        kèm CV, lịch phỏng vấn, phiếu chấm, offer, magic link, log.
        Các tin JD đầy đủ của đồng đội (Backend C#, SENIOR/MIDDLE BACKEND) ĐƯỢC GIỮ,
        chỉ sạch phần ứng viên.
     3. Bổ sung thông tin công ty còn trống (địa chỉ, email, điện thoại, phúc lợi
        mặc định) — mấy mục này in thẳng vào thư mời nhận việc.
     4. Tạo tài khoản Admin dùng để seed + demo: xem @DemoAdminEmail (mật khẩu demo123456).

   Chạy (BẮT BUỘC -f 65001, không thì chuỗi tiếng Việt vào DB bị hỏng mã):
     sqlcmd -S 165.101.46.34 -U sa -P *** -d SRIS_dev -C -I -f 65001 -i db/clean_team_demo.sql

   Sau đó seed:  python tools/seed_demo_full.py --admin demo.admin@sris.vn --pass demo123456 \
                        --base http://localhost:<port>/api
   (backend phải đang trỏ vào chính DB team này)
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @CompanyId BIGINT = 1;
DECLARE @DemoAdminEmail NVARCHAR(256) = N'demo.admin@sris.vn';
DECLARE @DemoAdminHash  NVARCHAR(256) = N'xVq9eKor5r2bUYny34hUAgD7zUl7uzyxTWAYI026l+k='; -- SHA256WithSalt('demo123456','salt')

-- Tin tuyển dụng bị xoá (đã soi tay từng dòng trước khi liệt kê).
DECLARE @JunkJobs TABLE (job_id BIGINT PRIMARY KEY);
INSERT INTO @JunkJobs (job_id) VALUES
    (6),      -- "Business Analysis" — JD 31 ký tự
    (7),      -- "UI/UX Designer"    — JD 180 ký tự, toàn ứng viên bấm tay khi test
    (8),      -- "Frontend Developer" — JD rỗng
    (10),     -- "Test"
    (11),     -- "Test 2"
    (22),     -- "Test 3"
    (25), (26), (27), (28), (29), (30),   -- lứa seed cũ [33d6e] / [79be5]
    (10025),  -- lứa seed demo cũ
    (10028),  -- "Senior .NET Developer" — JD 118 ký tự
    (10029),  -- "Intern Frontend Developer" — JD rỗng
    (10030),  -- "Develop System" — JD 46 ký tự
    (10031);  -- "Bao ve" — JD 147 ký tự, gõ không dấu

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);

BEGIN TRY
    BEGIN TRAN;

    /* ---------- 1) Dữ liệu ứng viên của công ty: xoá sạch ---------- */
    DELETE sc FROM dbo.InterviewScore sc
      JOIN dbo.InterviewSchedule s ON s.schedule_id = sc.schedule_id
     WHERE s.company_id = @CompanyId;
    DELETE f FROM dbo.InterviewFeedback f
      JOIN dbo.InterviewSchedule s ON s.schedule_id = f.schedule_id
     WHERE s.company_id = @CompanyId;

    UPDATE dbo.InterviewSchedule SET confirmed_slot_id = NULL WHERE company_id = @CompanyId;
    UPDATE dbo.InterviewSlot     SET booked_application_id = NULL WHERE company_id = @CompanyId;

    DELETE i FROM dbo.InterviewSlotInterviewer i
      JOIN dbo.InterviewSlot sl ON sl.slot_id = i.slot_id
     WHERE sl.company_id = @CompanyId;
    DELETE FROM dbo.InterviewSchedule WHERE company_id = @CompanyId;
    DELETE FROM dbo.InterviewSlot     WHERE company_id = @CompanyId;
    DELETE FROM dbo.InterviewSlotPool WHERE company_id = @CompanyId;

    DELETE FROM dbo.MagicLinkToken WHERE company_id = @CompanyId;
    DELETE FROM dbo.ActivityLog    WHERE company_id = @CompanyId;
    DELETE FROM dbo.EmailLog       WHERE company_id = @CompanyId;
    DELETE FROM dbo.InternalNote   WHERE company_id = @CompanyId;
    DELETE FROM dbo.OfferDetail    WHERE company_id = @CompanyId;
    DELETE FROM dbo.Application    WHERE company_id = @CompanyId;
    DELETE FROM dbo.CvDocument     WHERE company_id = @CompanyId;
    DELETE FROM dbo.Candidate      WHERE company_id = @CompanyId;

    /* ---------- 2) Tin tuyển dụng rác ---------- */
    DELETE FROM dbo.EvaluationCriteria WHERE job_id IN (SELECT job_id FROM @JunkJobs);
    DELETE FROM dbo.CriteriaExtraction WHERE job_id IN (SELECT job_id FROM @JunkJobs);
    DELETE FROM dbo.JobRequirement     WHERE job_id IN (SELECT job_id FROM @JunkJobs);
    DELETE FROM dbo.JobBenefit         WHERE job_id IN (SELECT job_id FROM @JunkJobs);
    -- Yêu cầu tuyển dụng đã gắn vào tin bị xoá: bỏ luôn (lứa seed cũ).
    DELETE FROM dbo.RecruitmentRequest WHERE job_id IN (SELECT job_id FROM @JunkJobs);
    DELETE FROM dbo.Job                WHERE job_id IN (SELECT job_id FROM @JunkJobs);

    /* ---------- 3) User rác do seed cũ đẻ ra (chỉ xoá khi đã hết tham chiếu) ---------- */
    DECLARE @DeadUsers TABLE (user_id BIGINT PRIMARY KEY);
    INSERT INTO @DeadUsers (user_id)
    SELECT u.user_id FROM dbo.[User] u
     WHERE u.company_id = @CompanyId
       AND u.email LIKE '%@demo.vn'
       AND NOT EXISTS (SELECT 1 FROM dbo.Job j WHERE j.created_by = u.user_id OR j.department_manager_id = u.user_id)
       AND NOT EXISTS (SELECT 1 FROM dbo.RecruitmentRequest r WHERE r.created_by = u.user_id OR r.reviewed_by = u.user_id)
       AND NOT EXISTS (SELECT 1 FROM dbo.Department d WHERE d.manager_user_id = u.user_id)
       AND NOT EXISTS (SELECT 1 FROM dbo.CriteriaExtraction e WHERE e.requested_by = u.user_id)
       AND NOT EXISTS (SELECT 1 FROM dbo.ActivityLog l WHERE l.user_id = u.user_id)
       AND NOT EXISTS (SELECT 1 FROM dbo.InternalNote n WHERE n.user_id = u.user_id);

    DELETE FROM dbo.UserAuthToken WHERE user_id IN (SELECT user_id FROM @DeadUsers);
    DELETE FROM dbo.[User]        WHERE user_id IN (SELECT user_id FROM @DeadUsers);

    /* ---------- 4) Hồ sơ công ty (chỉ bù chỗ đang trống) ---------- */
    UPDATE dbo.Company
       SET address       = COALESCE(NULLIF(LTRIM(RTRIM(address)), N''),
                                    N'Tầng 8, Toà nhà Sông Đà, 131 Trần Phú, Hà Đông, Hà Nội'),
           contact_email = COALESCE(NULLIF(LTRIM(RTRIM(contact_email)), N''), N'tuyendung@sris.vn'),
           phone         = COALESCE(NULLIF(LTRIM(RTRIM(phone)), N''), N'024 6666 8888'),
           default_benefits = COALESCE(NULLIF(LTRIM(RTRIM(default_benefits)), N''),
                                N'Lương tháng 13 và thưởng theo hiệu quả công việc' + CHAR(10)
                              + N'Bảo hiểm sức khoẻ cho nhân viên chính thức' + CHAR(10)
                              + N'12 ngày phép/năm, xét tăng lương 1 lần/năm' + CHAR(10)
                              + N'Team building 2 lần/năm, du lịch hè'),
           updated_at    = SYSUTCDATETIME()
     WHERE company_id = @CompanyId;

    /* ---------- 5) Tài khoản Admin để seed + demo ---------- */
    IF NOT EXISTS (SELECT 1 FROM dbo.[User] WHERE email = @DemoAdminEmail)
        INSERT INTO dbo.[User] (company_id, email, password_hash, role, status, full_name, created_at)
        VALUES (@CompanyId, @DemoAdminEmail, @DemoAdminHash, 'Admin', 'Active',
                N'Quản trị viên Demo', SYSUTCDATETIME());
    ELSE
        UPDATE dbo.[User] SET password_hash = @DemoAdminHash, status = 'Active'
         WHERE email = @DemoAdminEmail;

    -- Danh mục loại hình làm việc (dropdown tạo tin) — bù nếu thiếu.
    INSERT INTO dbo.EmploymentType (company_id, name, status, created_at)
    SELECT @CompanyId, v.name, 'Active', SYSUTCDATETIME()
      FROM (VALUES (N'Toàn thời gian'), (N'Bán thời gian'), (N'Hợp đồng'),
                   (N'Thực tập'), (N'Làm việc từ xa')) AS v(name)
     WHERE NOT EXISTS (SELECT 1 FROM dbo.EmploymentType e
                        WHERE e.company_id = @CompanyId AND e.name = v.name);

    COMMIT;

    SELECT job_id, LEFT(title, 45) AS con_lai, status, LEN(ISNULL(jd_text, '')) AS jd_len
      FROM dbo.Job WHERE company_id = @CompanyId ORDER BY job_id;
    SELECT user_id, email, role, full_name FROM dbo.[User]
     WHERE company_id = @CompanyId ORDER BY user_id;
    SELECT (SELECT COUNT(*) FROM dbo.Application WHERE company_id = @CompanyId) AS ho_so,
           (SELECT COUNT(*) FROM dbo.Candidate   WHERE company_id = @CompanyId) AS ung_vien;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    PRINT N'LOI: ' + ERROR_MESSAGE();
END CATCH

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
