/* =============================================================================
   SEED DEMO — ứng viên "đã phỏng vấn xong, chờ Department Manager duyệt tuyển".

   Tạo trong company_id = 1 (Demo Company):
     - Department "Phòng Kỹ thuật"
     - Job "Lập trình viên Backend (.NET) — Demo duyệt tuyển"
         department = 'Phòng Kỹ thuật'
         department_manager_id = user manager@test.com  (DM quyết tuyển)
     - 3 tiêu chí đánh giá (EvaluationCriteria, status APPROVED)
     - Slot pool vòng 1 + 2 slot đã BOOKED (lịch trong quá khứ = đã phỏng vấn xong)
     - 2 ứng viên, cả 2 ở state INTERVIEW, mỗi người có phiếu chấm SUBMITTED
       => Guard G2 đã đạt, sẵn sàng INTERVIEW -> OFFER.

   Sau khi chạy script này, gọi API POST /api/applications/{id}/offer bằng tài khoản
   manager@test.com để đẩy 1 hồ sơ sang OFFER (tạo OfferDetail + magic link).

   Chạy tay (KHÔNG nằm trong chuỗi migration).
   BẮT BUỘC có -f 65001: file này UTF-8, thiếu cờ đó sqlcmd đọc theo ANSI -> tên tiếng Việt
   vào DB thành mojibake ("Trần" -> "Tráº§n").
     sqlcmd -S localhost -E -C -d SRIS -f 65001 -i db\seed_offer_ready_candidate.sql

   Idempotent: chạy lại không nhân bản dữ liệu.
   ============================================================================= */

SET NOCOUNT ON;

-- RLS: mọi lệnh dưới đây chạy ngoài request nên phải tự set SESSION_CONTEXT.
DECLARE @companyId BIGINT = 1;
EXEC sp_set_session_context @key = N'CompanyId', @value = 1;

DECLARE @dmId          BIGINT = (SELECT user_id FROM dbo.[User] WHERE company_id = @companyId AND email = N'manager@test.com');
DECLARE @recruiterId   BIGINT = (SELECT user_id FROM dbo.[User] WHERE company_id = @companyId AND email = N'recruiter@test.com');
DECLARE @interviewerId BIGINT = (SELECT user_id FROM dbo.[User] WHERE company_id = @companyId AND email = N'interviewer@test.com');

IF @dmId IS NULL OR @interviewerId IS NULL
BEGIN
    RAISERROR(N'Thiếu user seed (manager@test.com / interviewer@test.com). Chạy DbMigrator trước.', 16, 1);
    RETURN;
END

DECLARE @deptName NVARCHAR(200) = N'Phòng Kỹ thuật';
DECLARE @jobTitle NVARCHAR(300) = N'Lập trình viên Backend (.NET) — Demo duyệt tuyển';
DECLARE @now DATETIME2(3) = SYSUTCDATETIME();

/* ---------------------------------------------------------------- Department */
IF NOT EXISTS (SELECT 1 FROM dbo.Department WHERE company_id = @companyId AND name = @deptName)
    INSERT INTO dbo.Department (company_id, name, description, status)
    VALUES (@companyId, @deptName, N'Phòng phụ trách sản phẩm & hệ thống', 'Active');

/* ---------------------------------------------------------------------- Job */
DECLARE @jobId BIGINT = (SELECT TOP 1 job_id FROM dbo.Job WHERE company_id = @companyId AND title = @jobTitle);

IF @jobId IS NULL
BEGIN
    INSERT INTO dbo.Job (company_id, title, jd_text, department, department_manager_id, created_by,
                         location, employment_type, work_mode, experience_level,
                         salary_min, salary_max, currency, deadline, skill_tags, status)
    VALUES (@companyId, @jobTitle,
            N'Tuyển Lập trình viên Backend .NET cho đội sản phẩm. Yêu cầu: 2+ năm kinh nghiệm C#/ASP.NET Core, '
          + N'thành thạo SQL Server và Entity Framework Core, hiểu REST API và kiến trúc phân lớp. '
          + N'Ưu tiên ứng viên từng làm hệ thống multi-tenant, biết Docker/CI-CD, giao tiếp tốt, chủ động trong công việc.',
            @deptName, @dmId, @recruiterId,
            N'Hà Nội', 'FULL_TIME', 'HYBRID', 'MID',
            18000000, 30000000, 'VND', DATEADD(DAY, 30, CAST(@now AS DATE)),
            N'C#,.NET,SQL Server,EF Core,REST API', 'Open');

    SET @jobId = SCOPE_IDENTITY();
END
ELSE
BEGIN
    -- Đảm bảo job luôn gắn đúng DM + phòng ban (kể cả khi chạy lại).
    UPDATE dbo.Job
       SET department = @deptName, department_manager_id = @dmId, status = 'Open', updated_at = @now
     WHERE job_id = @jobId;
END

/* ------------------------------------------------------- EvaluationCriteria */
IF NOT EXISTS (SELECT 1 FROM dbo.EvaluationCriteria WHERE company_id = @companyId AND job_id = @jobId)
BEGIN
    INSERT INTO dbo.EvaluationCriteria
        (company_id, job_id, name, weight, max_score, active, criteria_type, cv_matchable, source, status, approved_by, approved_at, keywords)
    VALUES
        (@companyId, @jobId, N'Kinh nghiệm C#/.NET từ 2 năm', 3.0, 10, 1, 'HARD', 1, 'MANUAL', 'APPROVED', @dmId, @now, N'C#,.NET,ASP.NET Core'),
        (@companyId, @jobId, N'Thành thạo SQL Server & EF Core', 2.0, 10, 1, 'HARD', 1, 'MANUAL', 'APPROVED', @dmId, @now, N'SQL Server,Entity Framework'),
        (@companyId, @jobId, N'Kỹ năng giao tiếp & làm việc nhóm', 1.0, 10, 1, 'SOFT', 0, 'MANUAL', 'APPROVED', @dmId, @now, N'giao tiếp,teamwork');
END

DECLARE @critId BIGINT = (SELECT TOP 1 criteria_id FROM dbo.EvaluationCriteria
                          WHERE company_id = @companyId AND job_id = @jobId ORDER BY criteria_id);

/* ------------------------------------------------------ Slot pool (vòng 1) */
DECLARE @poolId BIGINT = (SELECT TOP 1 pool_id FROM dbo.InterviewSlotPool
                          WHERE company_id = @companyId AND job_id = @jobId AND round_number = 1);

IF @poolId IS NULL
BEGIN
    INSERT INTO dbo.InterviewSlotPool (company_id, job_id, round_number, status, created_by)
    VALUES (@companyId, @jobId, 1, 'CLOSED', @recruiterId);
    SET @poolId = SCOPE_IDENTITY();
END

/* =============================================================================
   2 ứng viên — cùng kịch bản: đã phỏng vấn xong, phiếu chấm đã nộp (Guard G2 đạt).
   ============================================================================= */
DECLARE @i INT = 1;
WHILE @i <= 2
BEGIN
    DECLARE @name  NVARCHAR(200) = CASE @i WHEN 1 THEN N'Trần Minh Quân' ELSE N'Lê Thu Hà' END;
    DECLARE @email NVARCHAR(256) = CASE @i WHEN 1 THEN N'tran.minh.quan.demo@example.com' ELSE N'le.thu.ha.demo@example.com' END;
    DECLARE @phone VARCHAR(30)   = CASE @i WHEN 1 THEN '0912345678' ELSE '0987654321' END;
    DECLARE @ivScore DECIMAL(5,2)= CASE @i WHEN 1 THEN 8.5 ELSE 7.5 END;

    /* Candidate */
    DECLARE @candId BIGINT = (SELECT candidate_id FROM dbo.Candidate WHERE company_id = @companyId AND email = @email);
    IF @candId IS NULL
    BEGIN
        INSERT INTO dbo.Candidate (company_id, full_name, email, phone, source)
        VALUES (@companyId, @name, @email, @phone, N'Career Site');
        SET @candId = SCOPE_IDENTITY();
    END

    /* CvDocument — parse_status OK, có text để màn hồ sơ hiển thị */
    DECLARE @cvId BIGINT = (SELECT TOP 1 cv_id FROM dbo.CvDocument WHERE company_id = @companyId AND candidate_id = @candId);
    IF @cvId IS NULL
    BEGIN
        INSERT INTO dbo.CvDocument (company_id, candidate_id, extracted_text, parse_status, file_name, mime_type, file_size)
        VALUES (@companyId, @candId,
                @name + N' — Lập trình viên Backend. 3 năm kinh nghiệm C#/.NET, ASP.NET Core Web API, '
              + N'SQL Server, Entity Framework Core, Redis, Docker. Từng tham gia hệ thống SaaS multi-tenant. '
              + N'Tiếng Anh đọc hiểu tài liệu tốt, giao tiếp và làm việc nhóm chủ động.',
                'OK', N'cv_demo.pdf', 'application/pdf', 120000);
        SET @cvId = SCOPE_IDENTITY();
    END

    /* Application — dừng ở INTERVIEW (không còn cột điểm nào từ V030) */
    DECLARE @appId BIGINT = (SELECT TOP 1 application_id FROM dbo.[Application]
                             WHERE company_id = @companyId AND job_id = @jobId AND candidate_id = @candId);
    IF @appId IS NULL
    BEGIN
        INSERT INTO dbo.[Application] (company_id, job_id, candidate_id, cv_id, current_state,
                                       created_at, stage_updated_at)
        VALUES (@companyId, @jobId, @candId, @cvId, 'INTERVIEW',
                DATEADD(DAY, -12, @now), DATEADD(DAY, -3, @now));
        SET @appId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE dbo.[Application]
           SET current_state = 'INTERVIEW', reject_reason = NULL, rejected_at = NULL, hired_at = NULL,
               stage_updated_at = DATEADD(DAY, -3, @now)
         WHERE application_id = @appId;
    END

    /* Slot đã BOOKED cho hồ sơ này — giờ phỏng vấn ở quá khứ = đã phỏng vấn xong */
    DECLARE @slotId BIGINT = (SELECT TOP 1 slot_id FROM dbo.InterviewSlot
                              WHERE company_id = @companyId AND pool_id = @poolId AND booked_application_id = @appId);
    IF @slotId IS NULL
    BEGIN
        INSERT INTO dbo.InterviewSlot (company_id, pool_id, start_time, status, booked_application_id)
        VALUES (@companyId, @poolId, DATEADD(HOUR, @i, DATEADD(DAY, -3, @now)), 'BOOKED', @appId);
        SET @slotId = SCOPE_IDENTITY();
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.InterviewSlotInterviewer WHERE company_id = @companyId AND slot_id = @slotId AND interviewer_id = @interviewerId)
        INSERT INTO dbo.InterviewSlotInterviewer (company_id, slot_id, interviewer_id)
        VALUES (@companyId, @slotId, @interviewerId);

    /* InterviewSchedule — vòng 1, đã chốt slot */
    DECLARE @schedId BIGINT = (SELECT TOP 1 schedule_id FROM dbo.InterviewSchedule
                               WHERE company_id = @companyId AND application_id = @appId AND round_number = 1);
    IF @schedId IS NULL
    BEGIN
        INSERT INTO dbo.InterviewSchedule (company_id, application_id, round_number, status, confirmed_slot_id, pool_id)
        VALUES (@companyId, @appId, 1, 'CONFIRMED', @slotId, @poolId);
        SET @schedId = SCOPE_IDENTITY();
    END
    ELSE
        UPDATE dbo.InterviewSchedule
           SET status = 'CONFIRMED', confirmed_slot_id = @slotId, pool_id = @poolId, updated_at = @now
         WHERE schedule_id = @schedId;

    /* InterviewScore SUBMITTED — đây là thứ mở Guard G2 (INTERVIEW -> OFFER) */
    IF NOT EXISTS (SELECT 1 FROM dbo.InterviewScore
                   WHERE company_id = @companyId AND schedule_id = @schedId AND interviewer_id = @interviewerId AND criteria_id = @critId)
        INSERT INTO dbo.InterviewScore (company_id, schedule_id, interviewer_id, criteria_id, score, note, status)
        VALUES (@companyId, @schedId, @interviewerId, @critId, @ivScore,
                N'Nền tảng .NET vững, trả lời tốt câu hỏi về EF Core và tối ưu truy vấn. Đề xuất tuyển.', 'SUBMITTED');
    ELSE
        UPDATE dbo.InterviewScore
           SET score = @ivScore, status = 'SUBMITTED', updated_at = @now
         WHERE company_id = @companyId AND schedule_id = @schedId AND interviewer_id = @interviewerId AND criteria_id = @critId;

    PRINT CONCAT(N'  - ', @name, N' | application_id = ', @appId, N' | state = INTERVIEW | phiếu chấm SUBMITTED');

    SET @i = @i + 1;
END

PRINT CONCAT(N'Seed xong. job_id = ', @jobId, N' | DM (department_manager_id) = ', @dmId, N' (manager@test.com)');
GO
