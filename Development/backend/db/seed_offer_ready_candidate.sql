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
     - ĐỦ DỮ LIỆU CHO MÀN "QUYẾT ĐỊNH TUYỂN DỤNG" của DM: note theo TỪNG tiêu chí +
       kết luận của người phỏng vấn (InterviewFeedback: đề xuất + nhận xét tổng) +
       ghi chú nội bộ. Ứng viên 1 có 2 người chấm và họ KHÔNG đồng ý với nhau — để
       thấy màn quyết định xử lý ý kiến trái chiều thế nào.

   Sau khi chạy script này, gọi API POST /api/applications/{id}/offer bằng tài khoản
   manager@test.com để đẩy 1 hồ sơ sang OFFER (tạo OfferDetail + magic link).

   Chạy tay (KHÔNG nằm trong chuỗi migration).
   BẮT BUỘC có -f 65001: file này UTF-8, thiếu cờ đó sqlcmd đọc theo ANSI -> tên tiếng Việt
   vào DB thành mojibake ("Trần" -> "Tráº§n").
     sqlcmd -S localhost -E -C -d SRIS -f 65001 -i db\seed_offer_ready_candidate.sql

   Idempotent: chạy lại không nhân bản dữ liệu.
   ============================================================================= */

SET NOCOUNT ON;
-- sqlcmd bật QUOTED_IDENTIFIER OFF mặc định -> mọi INSERT vào bảng có filtered index
-- (vd User.email) đều lỗi 1934. Bật lại ngay đầu file cho chạy được bằng lệnh ở trên.
SET QUOTED_IDENTIFIER ON;

-- RLS: mọi lệnh dưới đây chạy ngoài request nên phải tự set SESSION_CONTEXT.
DECLARE @companyId BIGINT = 1;
EXEC sp_set_session_context @key = N'CompanyId', @value = 1;

DECLARE @dmId          BIGINT = (SELECT user_id FROM dbo.[User] WHERE company_id = @companyId AND email = N'manager@test.com');
DECLARE @recruiterId   BIGINT = (SELECT user_id FROM dbo.[User] WHERE company_id = @companyId AND email = N'recruiter@test.com');
DECLARE @interviewerId BIGINT = (SELECT user_id FROM dbo.[User] WHERE company_id = @companyId AND email = N'interviewer@test.com');

/* Người chấm thứ 2 để panel có ý kiến trái chiều. Chưa có tài khoản Interviewer thứ 2 thì
   mượn tạm DM — vẫn ra 2 phiếu khác nhau, chỉ là tên người chấm trùng vai DM. */
DECLARE @interviewer2Id BIGINT = COALESCE(
    (SELECT TOP 1 user_id FROM dbo.[User]
      WHERE company_id = @companyId AND role = 'Interviewer' AND user_id <> @interviewerId
      ORDER BY user_id),
    @dmId);

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
        -- Kéo hồ sơ về INTERVIEW để demo lại bước quyết định. Hồ sơ đã từng đi tới bước gửi
        -- thư mời thì phải DỌN offer + magic link của nó: để lại một offer ACCEPTED trên hồ
        -- sơ đang INTERVIEW là hai bảng nói hai chuyện khác nhau, màn quyết định và KPI đều
        -- đọc sai (và RecordOutcome sẽ từ chối vì hồ sơ không còn ở OFFER).
        DELETE FROM dbo.MagicLinkToken
         WHERE company_id = @companyId AND application_id = @appId AND purpose = 'OFFER_RESPONSE';

        DELETE FROM dbo.OfferDetail
         WHERE company_id = @companyId AND application_id = @appId;

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

    /* ---------------------------------------------------------------------
       Phiếu chấm SUBMITTED — mở Guard G2 (INTERVIEW -> OFFER) VÀ là nguồn cho màn
       quyết định: mỗi TIÊU CHÍ một note, vì người quyết đọc note chứ không đọc điểm.
       --------------------------------------------------------------------- */
    DECLARE @cIdx INT = 0;
    DECLARE @cid BIGINT, @cnote NVARCHAR(1000), @cscore DECIMAL(5,2);

    DECLARE crit_cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT criteria_id FROM dbo.EvaluationCriteria
         WHERE company_id = @companyId AND job_id = @jobId ORDER BY criteria_id;
    OPEN crit_cur;
    FETCH NEXT FROM crit_cur INTO @cid;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @cIdx = @cIdx + 1;
        SET @cscore = CASE WHEN @i = 1 THEN @ivScore ELSE @ivScore - 0.5 END;
        SET @cnote =
            CASE @cIdx
                WHEN 1 THEN CASE WHEN @i = 1
                    THEN N'Giải thích được vòng đời DbContext và vì sao tránh N+1; đã tự tay tối ưu một API từ 3s xuống 400ms.'
                    ELSE N'Biết dùng EF Core nhưng chưa đụng tới tối ưu truy vấn, chủ yếu làm theo mẫu có sẵn.' END
                WHEN 2 THEN CASE WHEN @i = 1
                    THEN N'Viết được truy vấn JOIN nhiều bảng ngay trên giấy, đọc được execution plan.'
                    ELSE N'Truy vấn cơ bản ổn, phần index còn mơ hồ.' END
                ELSE CASE WHEN @i = 1
                    THEN N'Trình bày mạch lạc, chủ động hỏi lại khi đề bài thiếu dữ kiện.'
                    ELSE N'Giao tiếp ổn, hơi ngại đặt câu hỏi ngược.' END
            END;

        IF NOT EXISTS (SELECT 1 FROM dbo.InterviewScore
                       WHERE company_id = @companyId AND schedule_id = @schedId
                         AND interviewer_id = @interviewerId AND criteria_id = @cid)
            INSERT INTO dbo.InterviewScore (company_id, schedule_id, interviewer_id, criteria_id, score, note, status)
            VALUES (@companyId, @schedId, @interviewerId, @cid, @cscore, @cnote, 'SUBMITTED');
        ELSE
            UPDATE dbo.InterviewScore
               SET score = @cscore, note = @cnote, status = 'SUBMITTED', updated_at = @now
             WHERE company_id = @companyId AND schedule_id = @schedId
               AND interviewer_id = @interviewerId AND criteria_id = @cid;

        /* Ứng viên 1: thêm người chấm thứ 2 cho ý kiến NGƯỢC lại — màn quyết định phải
           cho DM thấy ngay ca hội đồng không đồng thuận, đó là ca khó nhất. */
        IF @i = 1 AND @interviewer2Id <> @interviewerId
           AND NOT EXISTS (SELECT 1 FROM dbo.InterviewScore
                           WHERE company_id = @companyId AND schedule_id = @schedId
                             AND interviewer_id = @interviewer2Id AND criteria_id = @cid)
            INSERT INTO dbo.InterviewScore (company_id, schedule_id, interviewer_id, criteria_id, score, note, status)
            VALUES (@companyId, @schedId, @interviewer2Id, @cid, 6.0,
                    CASE @cIdx
                        WHEN 1 THEN N'Kinh nghiệm đi làm thật chỉ khoảng 1.5 năm, phần còn lại là dự án học tập.'
                        WHEN 2 THEN N'Chưa từng làm với dữ liệu lớn, chưa gặp bài toán khoá/deadlock.'
                        ELSE N'Nói nhiều về bản thân, chưa đưa được ví dụ làm việc nhóm cụ thể.'
                    END, 'SUBMITTED');

        FETCH NEXT FROM crit_cur INTO @cid;
    END
    CLOSE crit_cur; DEALLOCATE crit_cur;

    /* ---------------------------------------------------------------------
       InterviewFeedback (V031) — KẾT LUẬN của người phỏng vấn. Đây mới là thứ màn
       "Quyết định tuyển dụng" hiển thị: nên tuyển hay không, và VÌ SAO.
       --------------------------------------------------------------------- */
    DECLARE @rec1 VARCHAR(20)    = CASE WHEN @i = 1 THEN 'STRONG_HIRE' ELSE 'CONSIDER' END;
    DECLARE @sum1 NVARCHAR(2000) = CASE WHEN @i = 1
        THEN N'Ứng viên đúng thứ đội đang thiếu: làm chủ .NET và SQL ở mức tự tối ưu được, không chỉ dùng theo mẫu. '
           + N'Phần thiết kế hệ thống trả lời chắc, có dẫn ví dụ thật từ dự án cũ. Đề xuất tuyển và nên chốt sớm '
           + N'vì bạn đang phỏng vấn nơi khác.'
        ELSE N'Nền tảng ổn, thái độ tốt, nhưng chiều sâu kỹ thuật chưa tới mức vị trí này cần. Nếu tuyển thì phải '
           + N'chấp nhận kèm 2-3 tháng đầu. Tôi nghiêng về xem thêm ứng viên khác trước khi chốt.' END;

    IF NOT EXISTS (SELECT 1 FROM dbo.InterviewFeedback
                   WHERE company_id = @companyId AND schedule_id = @schedId AND interviewer_id = @interviewerId)
        INSERT INTO dbo.InterviewFeedback (company_id, schedule_id, interviewer_id, recommendation, summary, submitted_at)
        VALUES (@companyId, @schedId, @interviewerId, @rec1, @sum1, DATEADD(DAY, -3, @now));
    ELSE
        UPDATE dbo.InterviewFeedback
           SET recommendation = @rec1, summary = @sum1,
               submitted_at = DATEADD(DAY, -3, @now), updated_at = @now
         WHERE company_id = @companyId AND schedule_id = @schedId AND interviewer_id = @interviewerId;

    IF @i = 1 AND @interviewer2Id <> @interviewerId
    BEGIN
        DECLARE @sum2 NVARCHAR(2000) =
            N'Tôi không phản đối gay gắt, nhưng CV ghi 3 năm mà thực tế đi làm chỉ khoảng 1.5 năm. Chưa gặp bài '
          + N'toán vận hành thật (khoá, deadlock, dữ liệu lớn). Với mức lương đang đề xuất thì tôi thấy chưa '
          + N'tương xứng — nếu tuyển, nên thương lượng lại mức lương.';

        IF NOT EXISTS (SELECT 1 FROM dbo.InterviewFeedback
                       WHERE company_id = @companyId AND schedule_id = @schedId AND interviewer_id = @interviewer2Id)
            INSERT INTO dbo.InterviewFeedback (company_id, schedule_id, interviewer_id, recommendation, summary, submitted_at)
            VALUES (@companyId, @schedId, @interviewer2Id, 'NO_HIRE', @sum2, DATEADD(DAY, -3, @now));
        ELSE
            UPDATE dbo.InterviewFeedback
               SET recommendation = 'NO_HIRE', summary = @sum2,
                   submitted_at = DATEADD(DAY, -3, @now), updated_at = @now
             WHERE company_id = @companyId AND schedule_id = @schedId AND interviewer_id = @interviewer2Id;
    END

    /* Ghi chú nội bộ của Human Resource — bối cảnh thêm cho người quyết. */
    DECLARE @hrNote NVARCHAR(MAX) = CASE WHEN @i = 1
        THEN N'Ứng viên báo đang có offer khác, hạn trả lời bên kia là cuối tuần này.'
        ELSE N'Ứng viên linh hoạt thời gian, có thể bắt đầu ngay khi cần.' END;

    IF @recruiterId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.InternalNote
                       WHERE company_id = @companyId AND application_id = @appId AND content = @hrNote)
        INSERT INTO dbo.InternalNote (company_id, application_id, user_id, content)
        VALUES (@companyId, @appId, @recruiterId, @hrNote);

    PRINT CONCAT(N'  - ', @name, N' | application_id = ', @appId, N' | state = INTERVIEW | phiếu + kết luận đã nộp');

    SET @i = @i + 1;
END

PRINT CONCAT(N'Seed xong. job_id = ', @jobId, N' | DM (department_manager_id) = ', @dmId, N' (manager@test.com)');
PRINT N'Đăng nhập manager@test.com -> "Quyết Định Tuyển Dụng" để thấy kết luận của hội đồng phỏng vấn.';
GO
