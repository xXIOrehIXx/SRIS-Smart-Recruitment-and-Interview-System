/* =============================================================================
   MIGRATION V058 — BẢN SCAN HỢP ĐỒNG ĐÃ KÝ đính kèm thư mời nhận việc.

   Nghiệp vụ (chốt 21/09/2026): thư mời nhận việc giờ có khối XÁC NHẬN ở cuối —
   ứng viên in ra, ký vào câu "Tôi đã đọc và đồng ý với mọi điều khoản", gửi lại
   cho công ty, Giám đốc ký tiếp, rồi nhân sự SCAN bản có chữ ký hai bên. Chỗ
   nhân sự bấm "Đã nhận việc" có thêm ô đính kèm file scan đó.

   Vì sao BẢNG RIÊNG chứ không thêm vài cột vào OfferDetail:
   giấy tờ ký tay đi qua nhiều lượt (ứng viên ký -> Giám đốc ký -> scan lại; có
   lần scan mờ phải scan lại; có nơi ký thêm phụ lục). Nhét một cột file_url vào
   OfferDetail thì lần upload thứ hai ĐÈ mất bản thứ nhất, mà đây đúng là thứ
   người ta giữ để sau này tra "đã ký hợp đồng chưa, ký ngày nào". Mỗi lần upload
   là một dòng, kèm ai up và lúc nào — đó mới là lịch sử.

   File nằm trên MinIO (cùng chỗ với CV), cột file_url lưu OBJECT KEY chứ không
   phải URL tải: URL presigned hết hạn sau ~1 giờ, lưu vào DB là vài tháng sau mở
   ra được một cái link chết. Muốn xem thì sinh presigned mới lúc bấm.

   KHÔNG gắn với state machine: có file hay chưa KHÔNG chặn đường sang HIRED.
   Giấy ký tay thường về chậm vài ngày, ép nhập là hồ sơ kẹt ở bước Quyết định
   trong khi ứng viên đã đi làm. Đính kèm bổ sung sau lúc nào cũng được.

   Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.OfferAttachment', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OfferAttachment (
        attachment_id  BIGINT IDENTITY(1,1) NOT NULL,
        company_id     BIGINT               NOT NULL,
        offer_id       BIGINT               NOT NULL,
        -- Trùng thông tin với OfferDetail.application_id (1 offer / 1 hồ sơ) nhưng giữ lại:
        -- mọi màn hình ở đây đều đi theo application_id, không có cột này là join thêm một
        -- bảng chỉ để lấy đúng con số vừa dùng để tìm offer.
        application_id BIGINT               NOT NULL,

        -- Object key trên MinIO (vd 'offer-signed/3/91/ab12....pdf'), KHÔNG phải URL.
        file_url       NVARCHAR(500)        NOT NULL,
        -- Tên gốc lúc người dùng chọn file — hiện lại trên danh sách và đặt tên lúc tải về.
        file_name      NVARCHAR(255)        NOT NULL,
        file_size      INT                  NULL,
        mime_type      NVARCHAR(100)        NULL,

        -- SIGNED_CONTRACT = bản scan có chữ ký hai bên. Để dạng chuỗi có CHECK thay vì cờ
        -- bit: sau này còn bản scan phụ lục/giấy tờ tùy thân thì thêm giá trị, không phải
        -- đẻ thêm bảng.
        kind           VARCHAR(30)          NOT NULL
            CONSTRAINT DF_OfferAttachment_kind DEFAULT 'SIGNED_CONTRACT',
        note           NVARCHAR(500)        NULL,

        uploaded_by    BIGINT               NULL,
        created_at     DATETIME2(3)         NOT NULL
            CONSTRAINT DF_OfferAttachment_created DEFAULT SYSUTCDATETIME(),
        updated_at     DATETIME2(3)         NULL,

        CONSTRAINT PK_OfferAttachment      PRIMARY KEY (attachment_id),
        CONSTRAINT FK_OfferAttachment_Co   FOREIGN KEY (company_id)     REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_OfferAttachment_Off  FOREIGN KEY (offer_id)       REFERENCES dbo.OfferDetail(offer_id),
        CONSTRAINT FK_OfferAttachment_App  FOREIGN KEY (application_id) REFERENCES dbo.Application(application_id),
        CONSTRAINT FK_OfferAttachment_User FOREIGN KEY (uploaded_by)    REFERENCES dbo.[User](user_id),
        CONSTRAINT CK_OfferAttachment_kind CHECK (kind IN ('SIGNED_CONTRACT','OTHER'))
    );

    -- Màn chi tiết thư mời luôn hỏi "hồ sơ này có những file nào", mới nhất lên đầu.
    CREATE INDEX IX_OfferAttachment_app ON dbo.OfferAttachment(application_id, created_at DESC);
END
GO

/* RLS — bảng mới phải vào policy ngay (5.2). Không có worker nào đọc bảng này xuyên tenant. */
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy')
   AND NOT EXISTS (SELECT 1 FROM sys.security_predicates
                   WHERE target_object_id = OBJECT_ID('dbo.OfferAttachment'))
    ALTER SECURITY POLICY dbo.TenantSecurityPolicy
        ADD FILTER PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.OfferAttachment,
        ADD BLOCK  PREDICATE dbo.fn_TenantPredicate(company_id) ON dbo.OfferAttachment;
GO

PRINT N'Migration V058 xong: OfferAttachment (ban scan hop dong da ky) + RLS.';
GO
