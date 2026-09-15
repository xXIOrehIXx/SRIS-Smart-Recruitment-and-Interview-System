/* =============================================================================
   MIGRATION V057 — GIÁM ĐỐC CHỐT ĐƯỢC MỨC LƯƠNG KHI DUYỆT (chốt 15/09/2026, đảo V053).

   V053 bỏ approved_salary: Giám đốc chỉ duyệt đúng mức DM đề xuất, muốn mức khác thì phải
   "chưa duyệt" + ghi con số, DM sửa phiếu, gửi lại, Giám đốc duyệt lần hai. Chạy thực tế thì
   đó là một vòng đi-về chỉ để đổi MỘT con số mà Giám đốc đã biết từ lượt đầu — người có
   quyền quyết lại không được quyết, phải chờ người dưới gõ hộ.

   Từ V057: DM vẫn đề xuất một mức (bắt buộc), Giám đốc bấm duyệt thì ô lương điền sẵn mức
   đó — gật đầu thì để nguyên, muốn khác thì sửa ngay rồi chốt. Hai con số KHÔNG còn mập mờ
   như lo ngại của V053, vì vai trò của chúng khác hẳn nhau:
     - proposed_salary = DM ĐỀ XUẤT (lịch sử, không bao giờ vào thư mời trực tiếp)
     - approved_salary = Giám đốc CHỐT — con số DUY NHẤT thư mời dùng
   DM thấy cả hai trên màn của họ ("đề xuất 15tr → Giám đốc chốt 14tr").

   Backfill: phiếu APPROVED trong khoảng V053..V057 chỉ có proposed_salary (lúc đó duyệt
   nghĩa là gật đầu đúng số đó) — chép sang approved_salary để mọi phiếu đã duyệt đều có
   mức chốt, và thư mời chưa soạn vẫn ra đúng con số.

   Idempotent: chỉ thêm cột khi chưa có; backfill chỉ chạm dòng còn NULL.
   ============================================================================= */

SET NOCOUNT ON;

IF COL_LENGTH('dbo.HiringProposal', 'approved_salary') IS NULL
BEGIN
    ALTER TABLE dbo.HiringProposal ADD approved_salary DECIMAL(18,2) NULL;
    PRINT 'V057: da them dbo.HiringProposal.approved_salary.';
END
ELSE
    PRINT 'V057: dbo.HiringProposal.approved_salary da ton tai — bo qua ALTER.';

/* RLS: connection của migrator không có CompanyId -> predicate lọc sạch, UPDATE chạm 0 dòng mà
   không báo lỗi gì (chính backfill của V053 đã lặng lẽ hỏng như vậy). Dùng sentinel hệ thống
   -1 của V049 trên đúng connection này, xong trả về NULL. */
EXEC sp_set_session_context @key = N'CompanyId', @value = -1;

/* sp_executesql: cột vừa thêm trong cùng batch thì câu UPDATE viết thẳng sẽ lỗi biên dịch. */
EXEC sp_executesql N'
    UPDATE dbo.HiringProposal
       SET approved_salary = proposed_salary
     WHERE status = ''APPROVED''
       AND approved_salary IS NULL
       AND proposed_salary IS NOT NULL;
    PRINT ''V057: da backfill approved_salary cho '' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + '' phieu da duyet.'';';

EXEC sp_set_session_context @key = N'CompanyId', @value = NULL;
