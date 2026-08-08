using GP35.SRIS.Application.Contracts.Dtos.Business.Cv;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Tóm tắt CV bằng AI cho người tuyển dụng đọc lướt (V033).
/// <para>
/// Chỉ TRÍCH XUẤT nội dung CV. Không chấm điểm, không so với JD, không xếp hạng —
/// việc máy đánh giá ứng viên đã bỏ khỏi phạm vi hệ thống.
/// </para>
/// </summary>
public interface ICvSummaryService
{
    /// <summary>
    /// Đọc tóm tắt đã lưu. KHÔNG gọi AI — mở hồ sơ phải nhanh và không phụ thuộc Ollama.
    /// Chưa có tóm tắt thì trả Highlights rỗng.
    /// </summary>
    Task<CvSummaryDto> GetAsync(long companyId, long cvId);

    /// <summary>
    /// Sinh tóm tắt mới (gọi AI) rồi lưu lại. Người dùng chủ động bấm nút nên lỗi được
    /// ném ra để hiện thông báo, không nuốt im.
    /// </summary>
    Task<CvSummaryDto> GenerateAsync(long companyId, long cvId);
}
