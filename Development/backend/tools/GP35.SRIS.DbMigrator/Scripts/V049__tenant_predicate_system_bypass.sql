/* =============================================================================
   MIGRATION V049 — Sentinel "hệ thống" cho RLS, để worker thôi tắt policy toàn DB.

   VẤN ĐỀ ĐANG SỬA
   ---------------
   Ba worker nền (bóc tiêu chí, sàng lọc CV, tổng hợp hội đồng) chạy NGOÀI request nên
   không có SESSION_CONTEXT('CompanyId'); để giành được việc trong hàng đợi, mỗi lượt quét
   chúng làm đúng thế này:

       ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = OFF);
       UPDATE TOP(1) ... WHERE status = 'PENDING';
       ALTER SECURITY POLICY dbo.TenantSecurityPolicy WITH (STATE = ON);

   Hai hậu quả, cả hai đều nặng:

   1) SAI CHỨC NĂNG. Ba worker cùng quét mỗi 5 giây và giẫm lên nhau: worker B bật policy
      lại trước khi câu UPDATE của worker A kịp chạy -> UPDATE của A chạy lúc RLS đang BẬT,
      không có tenant -> predicate lọc sạch -> không giành được việc, ngủ 5 giây, lặp lại.
      Đo được trên log ngày 23/08/2026: một lượt bóc tiêu chí nằm PENDING 55 giây, trượt
      hơn 10 lượt quét, người dùng phải bấm nút 4 lần mới thấy chạy.

   2) THỦNG ĐA TENANT. STATE = OFF tắt RLS cho TOÀN DATABASE, không riêng connection của
      worker. Mọi request của công ty khác rơi đúng khoảng đó đọc được dữ liệu chéo. Với ba
      worker × mỗi 5 giây thì cửa sổ này mở suốt ngày.

   CÁCH SỬA
   --------
   Thêm một giá trị đặc biệt cho chính khoá sẵn có: CompanyId = -1 nghĩa là "tiến trình hệ
   thống, nhìn xuyên tenant". Worker set giá trị này trên ĐÚNG connection của nó (session
   context là per-connection), chạy câu giành việc, rồi trả về NULL. Không còn DDL, không
   còn ảnh hưởng lẫn nhau, không còn cửa sổ tắt RLS toàn cục.

   Vì sao dùng lại khoá 'CompanyId' thay vì thêm khoá 'TenantBypass' riêng: session context
   sống theo connection, mà connection thì nằm trong pool. Một khoá riêng sót lại giá trị
   bật sẽ tắt RLS cho bất kỳ request nào vớ phải connection đó. Còn 'CompanyId' thì
   TenantSessionConnectionInterceptor đóng dấu lại ở MỌI lần mở connection, nên giá trị -1
   sót lại không thể sống qua request kế tiếp.

   Hàm predicate bị SCHEMABINDING vào security policy nên không ALTER thẳng được: phải gỡ
   policy ra, sửa hàm, rồi dựng lại y nguyên. Danh sách bảng được đọc lại từ
   sys.security_predicates chứ không chép tay, để không sót bảng nào các migration sau đã
   thêm vào. Trong lúc script chạy thì RLS tắt — đây là đánh đổi một lần, thay cho việc nó
   đang tắt vài lần mỗi giây.
   Idempotent: chạy lại lần hai sẽ tự bỏ qua.
   ============================================================================= */

SET XACT_ABORT ON;

IF EXISTS (
    SELECT 1 FROM sys.sql_modules
    WHERE object_id = OBJECT_ID('dbo.fn_TenantPredicate')
      AND definition LIKE '%-- SYSTEM_TENANT_SENTINEL%'
)
BEGIN
    PRINT 'V049: fn_TenantPredicate da co sentinel he thong — bo qua.';
END
ELSE
BEGIN
    /* 1) Chụp lại toàn bộ predicate đang gắn trên policy (bảng nào, FILTER hay BLOCK,
          BLOCK thì cho thao tác nào). */
    IF OBJECT_ID('tempdb..#TenantPreds') IS NOT NULL DROP TABLE #TenantPreds;

    /* COLLATE DATABASE_DEFAULT ở mọi cột: catalog view trả sysname theo collation của
       server, ghép với literal của database là STRING_AGG báo "collation conflict". */
    SELECT
        CAST(sp.predicate_type_desc AS NVARCHAR(60)) COLLATE DATABASE_DEFAULT AS predicate_type_desc,
        CAST(sp.operation_desc      AS NVARCHAR(60)) COLLATE DATABASE_DEFAULT AS operation_desc,
        CAST(QUOTENAME(SCHEMA_NAME(o.schema_id)) + '.' + QUOTENAME(o.name)
             AS NVARCHAR(300)) COLLATE DATABASE_DEFAULT AS target_name,
        /* predicate_definition có dạng "([dbo].[fn_TenantPredicate]([company_id]))" —
           bỏ cặp ngoặc ngoài cùng, vì cú pháp ADD ... PREDICATE không nhận nó. */
        CAST(CASE
            WHEN LEFT(sp.predicate_definition, 1) = '('
             AND RIGHT(sp.predicate_definition, 1) = ')'
            THEN SUBSTRING(sp.predicate_definition, 2, LEN(sp.predicate_definition) - 2)
            ELSE sp.predicate_definition
        END AS NVARCHAR(MAX)) COLLATE DATABASE_DEFAULT AS pred_def
    INTO #TenantPreds
    FROM sys.security_predicates sp
    JOIN sys.security_policies pol ON pol.object_id = sp.object_id
    JOIN sys.objects o             ON o.object_id  = sp.target_object_id
    WHERE pol.name = 'TenantSecurityPolicy';

    IF NOT EXISTS (SELECT 1 FROM #TenantPreds)
        THROW 50049, 'V049: khong doc duoc predicate nao cua TenantSecurityPolicy — dung lai de khong pha RLS.', 1;

    DECLARE @adds NVARCHAR(MAX) = (
        SELECT STRING_AGG(
            CAST('ADD ' + predicate_type_desc + ' PREDICATE ' + pred_def
                 + ' ON ' + target_name
                 + ISNULL(' ' + operation_desc, '') AS NVARCHAR(MAX)),
            ', ')
        FROM #TenantPreds
    );

    /* 2) Gỡ policy -> sửa hàm -> dựng lại. ALTER FUNCTION phải đứng riêng một batch nên
          gói trong EXEC. */
    DROP SECURITY POLICY dbo.TenantSecurityPolicy;

    EXEC(N'
ALTER FUNCTION dbo.fn_TenantPredicate(@company_id BIGINT)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN
    -- SYSTEM_TENANT_SENTINEL: -1 = tien trinh he thong (worker hang doi, tra cuu luc dang
    -- nhap) duoc nhin xuyen tenant. Moi request that deu bi interceptor dong dau lai
    -- CompanyId that o moi lan mo connection, nen gia tri -1 khong song sot sang request khac.
    SELECT 1 AS allowed
    WHERE @company_id = CAST(SESSION_CONTEXT(N''CompanyId'') AS BIGINT)
       OR CAST(SESSION_CONTEXT(N''CompanyId'') AS BIGINT) = -1;
');

    EXEC(N'CREATE SECURITY POLICY dbo.TenantSecurityPolicy ' + @adds + N' WITH (STATE = ON);');

    DROP TABLE #TenantPreds;

    PRINT 'V049: da them sentinel CompanyId = -1 va dung lai TenantSecurityPolicy.';
END
GO
