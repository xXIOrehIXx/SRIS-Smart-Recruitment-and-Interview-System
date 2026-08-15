using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Đặt lịch phỏng vấn — bộ phận nhân sự (docs Section 15, viết lại 15/08/2026).
///
/// Nhân sự CHỦ ĐỘNG: gọi cho người phỏng vấn hỏi lịch rảnh, gọi cho ứng viên chốt giờ, rồi nhập
/// buổi vào hệ thống. Không còn pool khung mở cho ứng viên tự chọn — chờ ứng viên bấm link là
/// chậm hơn một cuộc gọi. Nhiều vòng = dữ liệu trong state INTERVIEW (5.12), không thêm state.
/// </summary>
public interface IInterviewScheduleService : IBaseService
{
    /// <summary>
    /// Đặt 1 buổi phỏng vấn cho ứng viên (đã được Trưởng bộ phận duyệt vào vòng phỏng vấn).
    /// Trả schedule_id để interviewer chấm điểm được. Gửi email xác nhận + .ics (best-effort).
    /// </summary>
    Task<long> BookAsync(long companyId, long userId, long applicationId, BookInterviewDto dto);

    /// <summary>Mọi buổi phỏng vấn của 1 vị trí (mới nhất trước).</summary>
    Task<IReadOnlyList<InterviewSessionDto>> GetByJobAsync(long companyId, long jobId);

    /// <summary>Hủy 1 buổi: khóa khung + lịch CANCELLED + email báo ứng viên (best-effort).</summary>
    Task CancelAsync(long companyId, long userId, long scheduleId, CancelInterviewDto dto);
}
