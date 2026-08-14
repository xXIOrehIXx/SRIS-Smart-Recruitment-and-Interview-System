/* =============================================================================
   MIGRATION V042 — UNIQUE(job_id, name) của EvaluationCriteria chỉ áp cho tiêu chí
   CÒN HIỆU LỰC (active = 1).

   Lỗi gặp thật: nút "Xoá" một tiêu chí là xoá MỀM (DeactivateAsync -> active = 0),
   dòng vẫn nằm lại trong bảng. Ràng buộc UQ_Crit_job_name cũ không có điều kiện lọc
   nên cái tên đó bị GIỮ CHỖ vĩnh viễn: người dùng xoá hết tiêu chí của tin tuyển dụng,
   bấm "AI đề xuất tiêu chí" lại, AI (temperature = 0) trả về đúng những tên vừa xoá
   -> INSERT vi phạm UNIQUE -> nổ giữa vòng lặp ghi.

   Hậu quả nhìn từ phía người dùng còn tệ hơn một lỗi thường: những tiêu chí ghi được
   TRƯỚC dòng bị đụng vẫn nằm lại trong DB, phần sau mất, còn màn hình chỉ báo "AI chưa
   đề xuất được tiêu chí" — bóc lại bao nhiêu lần cũng hỏng y như vậy vì tên vẫn bị giữ.

   Không thể sửa bằng cách xoá cứng các dòng active = 0: tiêu chí đã dùng để chấm phỏng
   vấn còn được InterviewScore tham chiếu, xoá là mất phiếu chấm đã nộp.

   Sau migration này: một tin tuyển dụng vẫn không thể có HAI tiêu chí còn hiệu lực
   trùng tên, nhưng tên của tiêu chí đã xoá thì dùng lại được.

   LƯU Ý khi thao tác tay bằng sqlcmd: bảng có chỉ mục lọc (filtered index) nên mọi lệnh
   INSERT/UPDATE/DELETE lên bảng này đòi SET QUOTED_IDENTIFIER ON — sqlcmd phải chạy kèm
   cờ -I, không thì báo lỗi 1934.
   ============================================================================= */

-- Ràng buộc cũ được tạo dưới dạng UNIQUE CONSTRAINT -> phải DROP CONSTRAINT.
IF EXISTS (SELECT 1 FROM sys.indexes
            WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria')
              AND name = 'UQ_Crit_job_name' AND is_unique_constraint = 1)
BEGIN
    ALTER TABLE dbo.EvaluationCriteria DROP CONSTRAINT UQ_Crit_job_name;
    PRINT N'V042: đã bỏ UNIQUE CONSTRAINT UQ_Crit_job_name.';
END
ELSE IF EXISTS (SELECT 1 FROM sys.indexes
                 WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria')
                   AND name = 'UQ_Crit_job_name')
BEGIN
    DROP INDEX UQ_Crit_job_name ON dbo.EvaluationCriteria;
    PRINT N'V042: đã bỏ INDEX UQ_Crit_job_name.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes
                WHERE object_id = OBJECT_ID('dbo.EvaluationCriteria')
                  AND name = 'UQ_Crit_job_name_active')
BEGIN
    CREATE UNIQUE INDEX UQ_Crit_job_name_active
        ON dbo.EvaluationCriteria (job_id, name)
        WHERE active = 1;
    PRINT N'V042: đã tạo UQ_Crit_job_name_active (chỉ ràng buộc dòng active = 1).';
END
GO

PRINT N'Migration V042 xong.';
