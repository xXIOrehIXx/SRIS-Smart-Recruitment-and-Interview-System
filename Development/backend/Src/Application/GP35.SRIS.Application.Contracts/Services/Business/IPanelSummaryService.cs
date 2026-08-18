using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// AI tổng hợp ý kiến hội đồng phỏng vấn (V047) — chạy nền, kết quả lưu lại để mở sau đọc từ DB.
///
/// <para>
/// RANH GIỚI: service này KHÔNG gọi <c>IApplicationStateService</c>, không đụng
/// <c>current_state</c>, và bản tổng hợp KHÔNG chứa kết luận nên tuyển hay không. Nó chỉ rút
/// gọn việc đọc 3-5 phiếu chấm dài. Quyền quyết tuyển vẫn của Giám đốc (V043) — cùng ranh giới
/// đã giữ ở sàng lọc CV (V044).
/// </para>
/// </summary>
public interface IPanelSummaryService : IBaseService
{
    /// <summary>Xếp hàng một lượt tổng hợp cho hồ sơ (ghi đè lượt cũ). Trả trạng thái ngay.</summary>
    Task<PanelSummaryStatusDto> RequestSummaryAsync(long companyId, long applicationId, long userId);

    /// <summary>Trạng thái + kết quả lượt tổng hợp gần nhất (NONE nếu chưa bao giờ chạy).</summary>
    Task<PanelSummaryStatusDto> GetStatusAsync(long companyId, long applicationId);

    /// <summary>
    /// Worker gọi: chạy thật một lượt và TỰ đóng dòng DONE/FAILED. Không được ném ra ngoài —
    /// dòng kẹt RUNNING là lượt tổng hợp treo vĩnh viễn dưới mắt người dùng.
    /// </summary>
    Task RunSummaryAsync(long companyId, long applicationId, long summaryId, CancellationToken ct = default);
}
