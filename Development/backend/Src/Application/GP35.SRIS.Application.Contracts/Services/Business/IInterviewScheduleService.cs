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

    /// <summary>
    /// Lịch bận của một nhóm người phỏng vấn trong khoảng [from, to) — đổ lên form đặt lịch để
    /// nhân sự chọn giờ không đụng buổi có sẵn (V047). Chỉ ĐỌC, không ảnh hưởng luật chống trùng.
    /// </summary>
    Task<IReadOnlyList<InterviewerBusySlotDto>> GetInterviewerBusyAsync(
        long companyId, IReadOnlyList<long> interviewerIds, DateTime fromUtc, DateTime toUtc);

    /// <summary>
    /// Sửa 1 buổi đã chốt: dời giờ / đổi panel / đổi tên vòng, giữ nguyên schedule_id (phiếu chấm
    /// đã có không mồ côi). Chạy lại đúng bộ luật của lúc đặt: hồ sơ phải còn ở INTERVIEW, panel
    /// phải nằm trong danh sách Trưởng bộ phận chỉ định, giờ phải ở tương lai và không đụng buổi
    /// khác. Gửi lại email xác nhận + .ics (best-effort).
    /// </summary>
    Task RescheduleAsync(long companyId, long userId, long scheduleId, RescheduleInterviewDto dto);

    /// <summary>Hủy 1 buổi: khóa khung + lịch CANCELLED + email báo ứng viên (best-effort).</summary>
    Task CancelAsync(long companyId, long userId, long scheduleId, CancelInterviewDto dto);
}
