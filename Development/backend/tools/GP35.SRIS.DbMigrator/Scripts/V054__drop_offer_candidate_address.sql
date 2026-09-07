/* =============================================================================
   MIGRATION V054 — BỎ "ĐỊA CHỈ ỨNG VIÊN" KHỎI THƯ MỜI NHẬN VIỆC (chốt 25/08/2026).

   Dòng địa chỉ in ở đầu thư là di sản của thư giấy gửi bưu điện. Ở đây thư mời đi bằng
   EMAIL (magic link + PDF đính kèm), nên không ai cần địa chỉ nhà ứng viên để gửi được thư.

   Tệ hơn: CV không lưu địa chỉ nên ô này luôn trống hoặc bắt nhân sự gõ tay một thông tin
   chẳng dùng vào việc gì — thêm một ô phải điền trong lúc soạn thư mời, đúng thứ sản phẩm
   này định bớt đi cho công ty nhỏ.

   Idempotent: chỉ xoá cột đang tồn tại.
   CẢNH BÁO: nhánh code cũ còn map cột này sẽ vỡ sau khi chạy.
   ============================================================================= */

SET NOCOUNT ON;

DECLARE @sql NVARCHAR(MAX);

IF COL_LENGTH('dbo.OfferDetail', 'candidate_address') IS NOT NULL
BEGIN
    /* Gỡ DEFAULT constraint (nếu có) trước, SQL Server không cho DROP COLUMN khi còn ràng buộc. */
    SELECT @sql = N'ALTER TABLE dbo.OfferDetail DROP CONSTRAINT ' + QUOTENAME(dc.name)
      FROM sys.default_constraints dc
      JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID('dbo.OfferDetail')
       AND c.name = 'candidate_address';
    IF @sql IS NOT NULL EXEC sp_executesql @sql;

    ALTER TABLE dbo.OfferDetail DROP COLUMN candidate_address;
    PRINT 'V054: da xoa dbo.OfferDetail.candidate_address.';
END
ELSE
    PRINT 'V054: dbo.OfferDetail.candidate_address khong ton tai — bo qua.';
