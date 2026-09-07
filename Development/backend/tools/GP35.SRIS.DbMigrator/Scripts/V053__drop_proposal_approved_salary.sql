/* =============================================================================
   MIGRATION V053 — BỎ "MỨC LƯƠNG CHỐT" KHỎI PHIẾU ĐỀ XUẤT TUYỂN (chốt 25/08/2026).

   Giám đốc KHÔNG gõ lại một con số lương nữa: phiếu đề xuất đã có mức Trưởng bộ phận đề
   xuất, và cửa "chưa duyệt" đã sẵn có. Lương không ổn thì Giám đốc CHƯA DUYỆT + ghi rõ
   muốn bao nhiêu (decision_note), Trưởng bộ phận đọc, sửa mức đề xuất rồi gửi lại — Giám
   đốc duyệt đúng con số mình đã yêu cầu.

   Hai con số cho cùng một khoản tiền là chỗ mập mờ: nhân sự soạn thư mời phải nhớ "lấy
   approved_salary hay proposed_salary", và Trưởng bộ phận không bao giờ thấy vì sao mức
   mình đề xuất bị đổi. Sau migration này chỉ còn MỘT con số — proposed_salary — và nó là
   con số Giám đốc đã gật đầu.

   GIỮ LẠI GIÁ TRỊ CŨ: phiếu đã duyệt mà Giám đốc từng chốt mức khác thì chép ngược
   approved_salary -> proposed_salary trước khi xoá cột, để thư mời chưa soạn vẫn ra đúng
   con số Giám đốc đã quyết. Thư mời ĐÃ gửi không đụng tới (OfferDetail.salary_amount giữ
   bản sao riêng của nó).

   Idempotent: chỉ xoá cột đang tồn tại.
   CẢNH BÁO: nhánh code cũ còn map cột này sẽ vỡ sau khi chạy.
   ============================================================================= */

SET NOCOUNT ON;

DECLARE @sql NVARCHAR(MAX);

IF COL_LENGTH('dbo.HiringProposal', 'approved_salary') IS NOT NULL
BEGIN
    /* Giữ lại quyết định của Giám đốc trước khi cột biến mất. */
    EXEC sp_executesql N'
        UPDATE dbo.HiringProposal
           SET proposed_salary = approved_salary
         WHERE status = ''APPROVED''
           AND approved_salary IS NOT NULL
           AND (proposed_salary IS NULL OR proposed_salary <> approved_salary);';

    /* Gỡ DEFAULT constraint (nếu có) trước, SQL Server không cho DROP COLUMN khi còn ràng buộc. */
    SELECT @sql = N'ALTER TABLE dbo.HiringProposal DROP CONSTRAINT ' + QUOTENAME(dc.name)
      FROM sys.default_constraints dc
      JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID('dbo.HiringProposal')
       AND c.name = 'approved_salary';
    IF @sql IS NOT NULL EXEC sp_executesql @sql;

    ALTER TABLE dbo.HiringProposal DROP COLUMN approved_salary;
    PRINT 'V053: da xoa dbo.HiringProposal.approved_salary (gia tri da chep ve proposed_salary).';
END
ELSE
    PRINT 'V053: dbo.HiringProposal.approved_salary khong ton tai — bo qua.';
