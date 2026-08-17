using GP35.SRIS.Application.Contracts.Dtos.Business.Cv;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Sàng lọc CV theo JD bằng AI (V044): tóm tắt CV + yêu cầu đạt/thiếu + đề xuất tham khảo.
/// <para>
/// Chạy NỀN như lượt bóc tiêu chí: xin phân tích chỉ xếp hàng rồi trả về ngay, worker mới
/// gọi AI. Local LLM trên CPU mất hàng chục giây — gọi đồng bộ là trình duyệt bỏ cuộc
/// (axios timeout 30s) trong khi backend vẫn đang chạy.
/// </para>
/// <para>
/// Service này KHÔNG đổi trạng thái hồ sơ. Đề xuất của AI chỉ để người tuyển dụng đọc.
/// </para>
/// </summary>
public interface ICvScreeningService
{
    /// <summary>
    /// Xếp hàng một lượt sàng lọc cho hồ sơ (đè lượt cũ). Ném lỗi ngay nếu biết chắc là vô ích
    /// (hồ sơ không tồn tại, tin tuyển dụng rỗng, CV không có text) — người dùng nhận lỗi tức
    /// thì thay vì đợi vài chục giây rồi mới biết.
    /// </summary>
    Task<CvScreeningStatusDto> RequestScreeningAsync(long companyId, long applicationId, long userId);

    /// <summary>
    /// Xếp hàng sàng lọc cho MỌI hồ sơ đang ở vòng sàng lọc (NEW + SCREENING) của 1 vị trí (V046).
    /// Bỏ qua hồ sơ đang chạy dở, và bỏ qua hồ sơ đã có kết quả trừ khi
    /// <paramref name="rescreenDone"/> = true.
    /// <para>
    /// Không kiểm từng CV có text hay không ở đây: đó là việc của worker, và hồ sơ hỏng hiện
    /// FAILED ngay trên card — người dùng thấy được hồ sơ nào cần nộp lại CV.
    /// </para>
    /// </summary>
    Task<JobScreeningQueueDto> RequestJobScreeningAsync(
        long companyId, long jobId, long userId, bool rescreenDone = false);

    /// <summary>Trạng thái + kết quả lượt gần nhất. Chưa bao giờ phân tích -> Status = NONE.</summary>
    Task<CvScreeningStatusDto> GetStatusAsync(long companyId, long applicationId);

    /// <summary>
    /// Chạy thật một lượt (worker gọi). TỰ đóng dòng hàng đợi DONE/FAILED và KHÔNG ném ra
    /// ngoài: một dòng kẹt RUNNING là lượt phân tích treo vĩnh viễn dưới mắt người dùng.
    /// </summary>
    Task RunScreeningAsync(long companyId, long applicationId, long screeningId, CancellationToken ct = default);
}
