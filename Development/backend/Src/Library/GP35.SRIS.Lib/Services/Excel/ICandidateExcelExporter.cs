namespace GP35.SRIS.Lib.Services.Excel;

/// <summary>
/// Xuất danh sách ứng viên của 1 vị trí ra file Excel (V047 — yêu cầu hội đồng 18/08/2026:
/// "bóc tách CV để lấy ra thông tin, fill vào Excel").
///
/// Chỉ định dạng dữ liệu đã có sẵn trong hệ thống — không gọi AI, không đọc DB.
/// </summary>
public interface ICandidateExcelExporter
{
    /// <summary>Nội dung file .xlsx (bytes) — không ghi đĩa, không đụng storage.</summary>
    byte[] Generate(CandidateExportModel model);

    /// <summary>Tên file gợi ý, vd "Ung-vien-Ke-toan-tong-hop-18-08-2026.xlsx" (đã bỏ dấu).</summary>
    string BuildFileName(CandidateExportModel model);
}
