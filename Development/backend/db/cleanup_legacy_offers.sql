/* =============================================================================
   DỌN DỮ LIỆU OFFER CŨ (chạy tay, không nằm trong chuỗi migration).

   Xoá hai loại rác sinh ra trước khi có thư mời dạng PDF (V029):

     (1) OfferDetail KHÔNG có nội dung thư (job_title NULL) — thời đó offer chỉ là
         "lương + ngày vào làm", nên giờ mở ra là một lá thư trống hoác.
     (2) OfferDetail MÂU THUẪN với trạng thái hồ sơ — offer ACCEPTED mà hồ sơ còn ở
         INTERVIEW, hoặc offer PENDING mà hồ sơ đã HIRED. Hai bảng lệch nhau thì màn
         quyết định lẫn KPI đều đọc sai.

   Kèm theo: xoá token OFFER_RESPONSE đã hết hạn / đã đốt (token chỉ phục vụ offer,
   hết hạn rồi thì không mở được nữa — giữ lại chỉ tổ rác bảng).

   KHÔNG đụng tới offer còn đúng: có nội dung thư VÀ khớp trạng thái hồ sơ.

   Chạy:
     sqlcmd -S localhost -E -C -d SRIS -f 65001 -i db\cleanup_legacy_offers.sql
   ============================================================================= */

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

DECLARE @companyId BIGINT = 1;
EXEC sp_set_session_context @key = N'CompanyId', @value = 1;

/* ---------------------------------------------------------------- Xem trước */
PRINT N'--- Offer sẽ bị xoá ---';

SELECT o.offer_id, o.application_id, o.status AS offer_status, a.current_state,
       CASE WHEN o.job_title IS NULL THEN N'thiếu nội dung thư' ELSE N'lệch trạng thái' END AS ly_do
FROM dbo.OfferDetail o
JOIN dbo.[Application] a ON a.application_id = o.application_id
WHERE o.company_id = @companyId
  AND (
        o.job_title IS NULL
        OR (o.status = 'ACCEPTED' AND a.current_state <> 'HIRED')
        OR (o.status = 'DECLINED' AND a.current_state <> 'REJECTED')
        OR (o.status = 'PENDING'  AND a.current_state <> 'OFFER')
      );

/* ------------------------------------------------------------------- Xoá */
BEGIN TRANSACTION;

DECLARE @doomed TABLE (offer_id BIGINT, application_id BIGINT);

INSERT INTO @doomed (offer_id, application_id)
SELECT o.offer_id, o.application_id
FROM dbo.OfferDetail o
JOIN dbo.[Application] a ON a.application_id = o.application_id
WHERE o.company_id = @companyId
  AND (
        o.job_title IS NULL
        OR (o.status = 'ACCEPTED' AND a.current_state <> 'HIRED')
        OR (o.status = 'DECLINED' AND a.current_state <> 'REJECTED')
        OR (o.status = 'PENDING'  AND a.current_state <> 'OFFER')
      );

/* Token OFFER_RESPONSE của chính những hồ sơ đó — link trỏ vào offer vừa xoá. */
DELETE t
FROM dbo.MagicLinkToken t
WHERE t.company_id = @companyId
  AND t.purpose = 'OFFER_RESPONSE'
  AND t.application_id IN (SELECT application_id FROM @doomed);

DELETE o
FROM dbo.OfferDetail o
WHERE o.offer_id IN (SELECT offer_id FROM @doomed);

/* Token OFFER_RESPONSE chết (hết hạn hoặc đã đốt) của MỌI hồ sơ còn lại. */
DELETE FROM dbo.MagicLinkToken
WHERE company_id = @companyId
  AND purpose = 'OFFER_RESPONSE'
  AND (expires_at < SYSUTCDATETIME() OR used_at IS NOT NULL);

COMMIT;

/* ------------------------------------------------------------- Kết quả */
PRINT N'--- Còn lại ---';

SELECT COUNT(*) AS offer_con_lai FROM dbo.OfferDetail WHERE company_id = @companyId;
SELECT purpose, COUNT(*) AS token_con_lai
FROM dbo.MagicLinkToken WHERE company_id = @companyId
GROUP BY purpose ORDER BY purpose;
GO
