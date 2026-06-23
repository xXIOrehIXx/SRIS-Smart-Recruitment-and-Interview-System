/* =============================================================================
   MIGRATION V009 — Question Bank (Việc 12, mô hình tích luỹ nội bộ).
   Câu MCQ đã được Recruiter duyệt được "ghim" vào ngân hàng cấp company để tái dùng
   cho quiz vị trí tương tự (đỡ gen lại, né trùng). KHÔNG nhập đề từ ngoài.

   Luồng: AI gen -> quiz DRAFT -> Recruiter duyệt (DRAFT->READY) -> các câu được harvest
   vào QuestionBankItem (bỏ trùng theo nội dung). Quiz DRAFT khác có thể kéo câu từ bank
   (times_used + 1). Idempotent.
   ============================================================================= */

IF OBJECT_ID('dbo.QuestionBankItem', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.QuestionBankItem (
        bank_item_id        BIGINT IDENTITY(1,1) NOT NULL,
        company_id          BIGINT               NOT NULL,
        content             NVARCHAR(MAX)        NOT NULL,
        options_json        NVARCHAR(MAX)        NOT NULL,   -- các lựa chọn dạng JSON
        correct_option      NVARCHAR(50)         NOT NULL,   -- nhãn đáp án đúng (vd 'A')
        topic               NVARCHAR(200)        NULL,
        difficulty          NVARCHAR(20)         NULL,
        source_question_id  BIGINT               NULL,       -- câu gốc trong QuizQuestion
        source_job_id       BIGINT               NULL,       -- job được duyệt từ
        approved_by         BIGINT               NULL,       -- user duyệt
        approved_at         DATETIME2(3)         NULL,
        times_used          INT                  NOT NULL CONSTRAINT DF_QBank_used   DEFAULT 0,
        active              BIT                  NOT NULL CONSTRAINT DF_QBank_active DEFAULT 1,
        created_at          DATETIME2(3)         NOT NULL CONSTRAINT DF_QBank_created DEFAULT SYSUTCDATETIME(),
        updated_at          DATETIME2(3)         NULL,
        CONSTRAINT PK_QuestionBankItem    PRIMARY KEY (bank_item_id),
        CONSTRAINT FK_QBank_Company       FOREIGN KEY (company_id) REFERENCES dbo.Company(company_id),
        CONSTRAINT CK_QBank_options_json  CHECK (ISJSON(options_json) = 1)
    );
END
GO

/* Tra/lọc bank theo tenant + lọc active, sắp mới nhất trước. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_QBank_company_active' AND object_id = OBJECT_ID('dbo.QuestionBankItem'))
    CREATE INDEX IX_QBank_company_active ON dbo.QuestionBankItem(company_id, active, bank_item_id DESC);
GO

PRINT N'Migration V009 xong: bảng QuestionBankItem + index.';
GO
