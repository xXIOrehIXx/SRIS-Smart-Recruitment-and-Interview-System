namespace GP35.SRIS.Application.Contracts.Dtos.Business.Cv;

/// <summary>
/// Tóm tắt CV cho người tuyển dụng đọc lướt thay vì tải PDF về (V033).
/// <para>
/// KHÔNG phải điểm số, KHÔNG phải đánh giá: chỉ là nội dung CV rút gọn. Hệ thống không
/// chấm và không xếp hạng ứng viên — người tuyển dụng tự đối chiếu với JD và tự quyết.
/// </para>
/// </summary>
public class CvSummaryDto
{
    public long CvId { get; set; }

    /// <summary>Các gạch đầu dòng. Rỗng = chưa tóm tắt lần nào (FE hiện nút để sinh).</summary>
    public List<string> Highlights { get; set; } = new();

    /// <summary>Mốc sinh tóm tắt. Null = chưa có.</summary>
    public DateTime? GeneratedAt { get; set; }

    /// <summary>
    /// True = CV này không bao giờ tóm tắt được (bản scan ảnh / parse hỏng nên không có text).
    /// FE ẩn hẳn nút thay vì để người dùng bấm rồi ăn lỗi.
    /// </summary>
    public bool CanSummarize { get; set; }
}
