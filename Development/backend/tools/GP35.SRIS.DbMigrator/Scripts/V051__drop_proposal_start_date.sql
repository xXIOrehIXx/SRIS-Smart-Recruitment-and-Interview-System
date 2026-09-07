/* =============================================================================
   MIGRATION V051 — BỎ NGÀY VÀO LÀM KHỎI PHIẾU ĐỀ XUẤT TUYỂN (chốt 24/08/2026).

   Giám đốc quyết TIỀN, không quyết NGÀY. Ngày ứng viên đi làm được là kết quả một cuộc
   gọi giữa bộ phận nhân sự và ứng viên (ứng viên còn phải báo trước cho chỗ làm cũ), nên
   nó được nhập ở THƯ MỜI — dbo.OfferDetail.start_date, chỗ nhân sự soạn thư.

   Hai cột dưới đây là dấu vết của mô hình cũ ("duyệt kèm lương + ngày vào làm"): bắt Trưởng
   bộ phận đoán ngày từ trước cả tuần, rồi Giám đốc duyệt lại đúng con số đoán đó — và nếu
   duyệt muộn vài ngày thì ngày đã trôi vào quá khứ, hệ thống chặn không cho duyệt.

   Mức lương Giám đốc chốt (approved_salary) GIỮ NGUYÊN — đó mới là điều khoản của Giám đốc.

   Idempotent: chỉ xoá cột đang tồn tại.
   CẢNH BÁO: nhánh code cũ còn map hai cột này sẽ vỡ sau khi chạy.
   ============================================================================= */

SET NOCOUNT ON;

DECLARE @sql NVARCHAR(MAX);

/* proposed_start_date — DM đề xuất */
IF COL_LENGTH('dbo.HiringProposal', 'proposed_start_date') IS NOT NULL
BEGIN
    /* Gỡ DEFAULT constraint (nếu có) trước, SQL Server không cho DROP COLUMN khi còn ràng buộc. */
    SELECT @sql = N'ALTER TABLE dbo.HiringProposal DROP CONSTRAINT ' + QUOTENAME(dc.name)
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.HiringProposal') AND c.name = 'proposed_start_date';
    IF @sql IS NOT NULL EXEC sp_executesql @sql;

    ALTER TABLE dbo.HiringProposal DROP COLUMN proposed_start_date;
    PRINT N'V051: đã xoá dbo.HiringProposal.proposed_start_date.';
END
GO

/* approved_start_date — Giám đốc chốt */
DECLARE @sql2 NVARCHAR(MAX);

IF COL_LENGTH('dbo.HiringProposal', 'approved_start_date') IS NOT NULL
BEGIN
    SELECT @sql2 = N'ALTER TABLE dbo.HiringProposal DROP CONSTRAINT ' + QUOTENAME(dc.name)
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.HiringProposal') AND c.name = 'approved_start_date';
    IF @sql2 IS NOT NULL EXEC sp_executesql @sql2;

    ALTER TABLE dbo.HiringProposal DROP COLUMN approved_start_date;
    PRINT N'V051: đã xoá dbo.HiringProposal.approved_start_date.';
END
GO

PRINT N'Migration V051 xong: phiếu đề xuất tuyển chỉ còn điều khoản LƯƠNG của Giám đốc.';
GO
