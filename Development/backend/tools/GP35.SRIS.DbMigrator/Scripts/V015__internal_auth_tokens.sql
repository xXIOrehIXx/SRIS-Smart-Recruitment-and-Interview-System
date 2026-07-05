/* =============================================================================
   MIGRATION V015 — token xác thực nội bộ (User đăng nhập Portal, KHÁC magic link ứng viên).
   Phục vụ: refresh token (giữ phiên) + reset mật khẩu (quên mật khẩu).
   Lưu HASH (SHA-256 hex), không lưu token gốc — như MagicLinkToken.

   KHÔNG đặt dưới RLS: token tra được TRƯỚC khi có phiên (forgot-password/refresh chạy ẩn danh),
   nên lookup dùng pattern tắt-policy như UserRepo.GetByEmail. Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.UserAuthToken', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserAuthToken (
        token_id     BIGINT IDENTITY(1,1) NOT NULL,
        company_id   BIGINT               NOT NULL,
        user_id      BIGINT               NOT NULL,
        token_hash   CHAR(64)             NOT NULL,   -- SHA-256 hex
        purpose      VARCHAR(20)          NOT NULL,   -- REFRESH | PASSWORD_RESET
        expires_at   DATETIME2(3)         NOT NULL,
        used_at      DATETIME2(3)         NULL,       -- đốt khi dùng (reset) / thu hồi (refresh)
        created_at   DATETIME2(3)         NOT NULL CONSTRAINT DF_UAT_created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_UserAuthToken   PRIMARY KEY (token_id),
        CONSTRAINT FK_UAT_Company     FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
        CONSTRAINT FK_UAT_User        FOREIGN KEY (user_id)    REFERENCES dbo.[User](user_id),
        CONSTRAINT UQ_UAT_hash        UNIQUE (token_hash),
        CONSTRAINT CK_UAT_purpose     CHECK (purpose IN ('REFRESH','PASSWORD_RESET'))
    );
    CREATE INDEX IX_UAT_user_purpose ON dbo.UserAuthToken(user_id, purpose);
END
GO

PRINT N'Migration V015 xong: bảng UserAuthToken (refresh + password reset cho User nội bộ).';
GO
