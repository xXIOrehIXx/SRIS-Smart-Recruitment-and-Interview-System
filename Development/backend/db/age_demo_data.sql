/* =============================================================================
   GIÃN NGÀY THÁNG CHO DỮ LIỆU DEMO VỪA SEED

   Seed qua API thì mọi hồ sơ đều có created_at = hôm nay -> dashboard ra "thời gian
   tuyển trung bình 0 ngày", biểu đồ theo thời gian dồn hết vào 1 cột. Script này rải
   ngày nộp hồ sơ ra 50 ngày gần nhất rồi suy ra các mốc sau đó (chuyển pha, nhận việc,
   bị loại, ngày gửi thư mời) cho khớp.

   KHÔNG đụng tới lịch phỏng vấn (InterviewSchedule/InterviewSlot): các buổi phỏng vấn
   phải nằm ở tương lai thì màn "Lịch phỏng vấn sắp tới" mới có dữ liệu.

   Chạy:
     sqlcmd -S <server> -d <db> -C -I -f 65001 -v CompanyId=1 -v CutoffDate=2026-08-14 \
            -i db/age_demo_data.sql

   CutoffDate: chỉ giãn các bản ghi tạo TỪ ngày này trở đi (= lứa seed vừa chạy), dữ liệu
   cũ của đồng đội trên DB team giữ nguyên. Chỉ nhận yyyy-mm-dd — tham số -v của sqlcmd
   cắt chuỗi ở dấu cách và dấu hai chấm nên không truyền được cả giờ.

   CHẠY LẠI LẦN 2: lứa seed lúc này đã bị kéo lùi ngày rồi nên phải truyền CutoffDate
   sớm hơn ngày lùi xa nhất (ví dụ 2026-06-01), không thì script không thấy dòng nào.
   Công thức chỉ phụ thuộc thứ tự application_id nên chạy lại vẫn ra bố cục cũ.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @CompanyId BIGINT     = CAST('$(CompanyId)' AS BIGINT);
DECLARE @Cutoff    DATETIME2  = CAST('$(CutoffDate)' AS DATETIME2);
DECLARE @Now       DATETIME2  = SYSUTCDATETIME();

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);

BEGIN TRY
    BEGIN TRAN;

    /* ---- 1) Ngày nộp hồ sơ: rải đều 50 ngày gần nhất ---- */
    DECLARE @aged TABLE (application_id BIGINT PRIMARY KEY, applied_at DATETIME2, age_days INT);

    INSERT INTO @aged (application_id, applied_at, age_days)
    SELECT x.application_id,
           DATEADD(HOUR, -((x.rn * 37 % 50) * 24 + (x.rn * 7 % 9) + 8), @Now),
           (x.rn * 37 % 50)
      FROM (SELECT application_id, ROW_NUMBER() OVER (ORDER BY application_id) AS rn
              FROM dbo.Application
             WHERE company_id = @CompanyId AND created_at >= @Cutoff) AS x;

    UPDATE a
       SET a.created_at      = g.applied_at,
           -- mốc đổi pha gần nhất: khoảng 40% quãng đường từ lúc nộp tới nay
           a.stage_updated_at = DATEADD(DAY, g.age_days * 4 / 10, g.applied_at),
           a.hired_at        = CASE WHEN a.current_state = 'HIRED'
                                    THEN DATEADD(DAY, g.age_days * 7 / 10, g.applied_at) END,
           a.rejected_at     = CASE WHEN a.current_state = 'REJECTED'
                                    THEN DATEADD(DAY, g.age_days * 5 / 10, g.applied_at) END,
           a.updated_at      = @Now
      FROM dbo.Application a JOIN @aged g ON g.application_id = a.application_id;

    /* ---- 2) Ứng viên + file CV: cùng ngày nộp ---- */
    UPDATE c SET c.created_at = g.applied_at
      FROM dbo.Candidate c
      JOIN dbo.Application a ON a.candidate_id = c.candidate_id
      JOIN @aged g ON g.application_id = a.application_id;

    UPDATE cv SET cv.created_at = g.applied_at
      FROM dbo.CvDocument cv
      JOIN dbo.Application a ON a.cv_id = cv.cv_id
      JOIN @aged g ON g.application_id = a.application_id;

    /* ---- 3) Thư mời nhận việc: gửi ở ~60% quãng đường ---- */
    UPDATE o
       SET o.created_at   = DATEADD(DAY, g.age_days * 6 / 10, g.applied_at),
           o.sent_at      = DATEADD(DAY, g.age_days * 6 / 10, g.applied_at),
           o.responded_at = CASE WHEN o.responded_at IS NOT NULL
                                 THEN DATEADD(DAY, g.age_days * 7 / 10, g.applied_at) END
      FROM dbo.OfferDetail o JOIN @aged g ON g.application_id = o.application_id;

    /* ---- 4) Buổi phỏng vấn ĐÃ CHẤM XONG: kéo về quá khứ ----
       API chặn đặt lịch ở quá khứ nên lúc seed buộc phải hẹn ngày tương lai — hệ quả là
       người đã có phiếu chấm/đã nhận việc vẫn hiện trong "Lịch phỏng vấn sắp tới".
       Buổi nào đã có phiếu NỘP thì dời về mốc ~55% quãng đường kể từ ngày nộp hồ sơ;
       buổi chưa chấm (mới mời / vừa chốt giờ) giữ nguyên ở tương lai. */
    UPDATE sl
       SET sl.start_time = DATEADD(DAY, g.age_days * 55 / 100, g.applied_at),
           sl.updated_at = @Now
      FROM dbo.InterviewSlot sl
      JOIN dbo.InterviewSchedule s ON s.confirmed_slot_id = sl.slot_id
      JOIN @aged g ON g.application_id = s.application_id
     WHERE EXISTS (SELECT 1 FROM dbo.InterviewScore sc
                    WHERE sc.schedule_id = s.schedule_id AND sc.status = 'SUBMITTED');

    UPDATE sc
       SET sc.created_at = DATEADD(DAY, g.age_days * 55 / 100, g.applied_at),
           sc.updated_at = DATEADD(DAY, g.age_days * 55 / 100, g.applied_at)
      FROM dbo.InterviewScore sc
      JOIN dbo.InterviewSchedule s ON s.schedule_id = sc.schedule_id
      JOIN @aged g ON g.application_id = s.application_id
     WHERE sc.status = 'SUBMITTED';

    /* ---- 5) Tin tuyển dụng: đăng trước hồ sơ đầu tiên 3 ngày ---- */
    UPDATE j
       SET j.created_at = COALESCE(DATEADD(DAY, -3, x.first_apply), DATEADD(DAY, -20, @Now))
      FROM dbo.Job j
      OUTER APPLY (SELECT MIN(g.applied_at) AS first_apply
                     FROM dbo.Application a JOIN @aged g ON g.application_id = a.application_id
                    WHERE a.job_id = j.job_id) AS x
     WHERE j.company_id = @CompanyId AND j.created_at >= @Cutoff;

    COMMIT;

    SELECT current_state,
           COUNT(*) AS n,
           MIN(CONVERT(date, created_at)) AS som_nhat,
           MAX(CONVERT(date, created_at)) AS muon_nhat,
           AVG(DATEDIFF(DAY, created_at, hired_at)) AS ngay_tuyen_tb
      FROM dbo.Application
     WHERE company_id = @CompanyId
     GROUP BY current_state ORDER BY current_state;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    PRINT N'LOI: ' + ERROR_MESSAGE();
END CATCH

ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);
