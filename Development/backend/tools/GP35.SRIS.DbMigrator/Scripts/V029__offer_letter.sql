/* =============================================================================
   MIGRATION V029 — Thư mời nhận việc (Offer Letter) thay cho trang bấm Đồng ý/Từ chối.

   Đổi nghiệp vụ (5.15 bản mới): ứng viên KHÔNG bấm nút trong hệ thống nữa. Qua
   phỏng vấn -> Recruiter/DM soạn thư mời -> hệ thống gửi email kèm link, link mở
   ra file PDF thư mời nhận việc. Ứng viên trả lời ngoài hệ thống (email/điện
   thoại), Recruiter vào Portal ghi nhận kết quả -> HIRED / REJECTED.

   Vì thế OfferDetail phải chứa ĐỦ nội dung một lá thư, không chỉ lương + ngày vào
   làm. Các mục lấy được từ Job (phòng ban, hình thức, địa điểm) vẫn lưu lại vào
   offer: thư đã gửi là văn bản đối ngoại, sửa Job về sau không được phép làm đổi
   nội dung thư đã phát đi.

   status GIỮ NGUYÊN 3 giá trị cũ (PENDING/ACCEPTED/DECLINED — CK_Offer_status
   không đổi), chỉ đổi CÁCH ĐỌC:
     PENDING  = đã gửi thư, chờ ứng viên trả lời (ngoài hệ thống)
     ACCEPTED = Recruiter ghi nhận ứng viên nhận việc  -> Application HIRED
     DECLINED = Recruiter ghi nhận ứng viên từ chối    -> Application REJECTED
   Nhờ vậy KPI offer acceptance rate (Dashboard) chạy nguyên như cũ.

   Idempotent.
   ============================================================================= */

/* ---------------------------------------------------------------------------
   (1) Company: thông tin liên hệ in ở đầu thư (địa chỉ / email / điện thoại).
       Nhập một lần ở hồ sơ công ty, mọi thư mời sau đều tự có.
   --------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.Company', 'address') IS NULL
    ALTER TABLE dbo.Company ADD address NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.Company', 'contact_email') IS NULL
    ALTER TABLE dbo.Company ADD contact_email NVARCHAR(256) NULL;
GO

IF COL_LENGTH('dbo.Company', 'phone') IS NULL
    ALTER TABLE dbo.Company ADD phone NVARCHAR(50) NULL;
GO

/* ---------------------------------------------------------------------------
   (2) OfferDetail: các mục của mẫu thư.
       NVARCHAR hết — thư viết tiếng Việt có dấu (bài học V026: VARCHAR ăn dấu
       hỏi). Tất cả NULL được: thư thiếu mục nào thì bản PDF bỏ dòng đó.
   --------------------------------------------------------------------------- */

/* Khối "Thông tin vị trí" — chụp lại từ Job lúc soạn thư, sửa được. */
IF COL_LENGTH('dbo.OfferDetail', 'job_title') IS NULL
    ALTER TABLE dbo.OfferDetail ADD job_title NVARCHAR(200) NULL;
GO

IF COL_LENGTH('dbo.OfferDetail', 'department') IS NULL
    ALTER TABLE dbo.OfferDetail ADD department NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.OfferDetail', 'reporting_to') IS NULL
    ALTER TABLE dbo.OfferDetail ADD reporting_to NVARCHAR(200) NULL;
GO

IF COL_LENGTH('dbo.OfferDetail', 'employment_type') IS NULL
    ALTER TABLE dbo.OfferDetail ADD employment_type NVARCHAR(100) NULL;
GO

IF COL_LENGTH('dbo.OfferDetail', 'work_location') IS NULL
    ALTER TABLE dbo.OfferDetail ADD work_location NVARCHAR(300) NULL;
GO

/* Khối "Lương & Phúc lợi" — salary_amount/currency đã có từ V001. */
IF COL_LENGTH('dbo.OfferDetail', 'salary_period') IS NULL
    ALTER TABLE dbo.OfferDetail ADD salary_period NVARCHAR(20) NULL;   -- 'THANG' | 'NAM'
GO

IF COL_LENGTH('dbo.OfferDetail', 'bonus') IS NULL
    ALTER TABLE dbo.OfferDetail ADD bonus NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.OfferDetail', 'benefits') IS NULL
    ALTER TABLE dbo.OfferDetail ADD benefits NVARCHAR(1000) NULL;
GO

/* Khối "Điều khoản & Điều kiện" + chân thư. */
IF COL_LENGTH('dbo.OfferDetail', 'terms') IS NULL
    ALTER TABLE dbo.OfferDetail ADD terms NVARCHAR(2000) NULL;
GO

IF COL_LENGTH('dbo.OfferDetail', 'hr_contact_name') IS NULL
    ALTER TABLE dbo.OfferDetail ADD hr_contact_name NVARCHAR(200) NULL;
GO

IF COL_LENGTH('dbo.OfferDetail', 'hr_contact_email') IS NULL
    ALTER TABLE dbo.OfferDetail ADD hr_contact_email NVARCHAR(256) NULL;
GO

IF COL_LENGTH('dbo.OfferDetail', 'signer_name') IS NULL
    ALTER TABLE dbo.OfferDetail ADD signer_name NVARCHAR(200) NULL;
GO

IF COL_LENGTH('dbo.OfferDetail', 'signer_title') IS NULL
    ALTER TABLE dbo.OfferDetail ADD signer_title NVARCHAR(200) NULL;
GO

/* Địa chỉ ứng viên in ở đầu thư — Candidate không có cột này, gõ tay lúc soạn. */
IF COL_LENGTH('dbo.OfferDetail', 'candidate_address') IS NULL
    ALTER TABLE dbo.OfferDetail ADD candidate_address NVARCHAR(500) NULL;
GO

/* Ai ghi nhận kết quả cuối (nhận việc / từ chối) — khác decided_by (người ra offer). */
IF COL_LENGTH('dbo.OfferDetail', 'outcome_by') IS NULL
    ALTER TABLE dbo.OfferDetail ADD outcome_by BIGINT NULL;
GO

/* Lý do/ghi chú kèm khi ghi nhận kết quả (vd "ứng viên nhận offer công ty khác"). */
IF COL_LENGTH('dbo.OfferDetail', 'outcome_note') IS NULL
    ALTER TABLE dbo.OfferDetail ADD outcome_note NVARCHAR(500) NULL;
GO

/* ---------------------------------------------------------------------------
   (3) Nới note: V005 để NVARCHAR(500); thư mời cần chỗ cho lời nhắn dài hơn.
   --------------------------------------------------------------------------- */
IF COL_LENGTH('dbo.OfferDetail', 'note') IS NOT NULL
    AND EXISTS (SELECT 1 FROM sys.columns
                WHERE object_id = OBJECT_ID('dbo.OfferDetail')
                  AND name = 'note' AND max_length < 2000)   -- max_length = byte, NVARCHAR(500) = 1000
    ALTER TABLE dbo.OfferDetail ALTER COLUMN note NVARCHAR(1000) NULL;
GO

PRINT N'Migration V029 xong: Company.address/contact_email/phone + OfferDetail các mục thư mời nhận việc.';
GO
