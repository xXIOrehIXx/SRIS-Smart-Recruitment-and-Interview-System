using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>
/// Đặt lịch phỏng vấn — phía Recruiter (docs Section 15). Tạo lịch (vòng) + khung giờ cho hồ sơ
/// đang ở INTERVIEW, kèm phát magic link SCHEDULE. Nhiều vòng = dữ liệu trong INTERVIEW (5.12).
/// </summary>
public interface IInterviewSchedulingService : IBaseService
{
    /// <summary>Tạo 1 Interview Request (1 vòng) + mở khung + phát magic link SCHEDULE.</summary>
    Task<CreateInterviewRequestResultDto> CreateRequestAsync(
        long companyId, long userId, long applicationId, CreateInterviewRequestDto dto);

    /// <summary>Mọi lịch của hồ sơ (Recruiter xem trên Kanban).</summary>
    Task<IReadOnlyList<InterviewScheduleDto>> GetByApplicationAsync(long companyId, long applicationId);

    /// <summary>
    /// Dời lịch: thay bộ khung của 1 lịch + mở lại cho ứng viên chọn + phát lại magic link SCHEDULE.
    /// CHỈ cho dời 1 lần / lịch (reschedule_count). Không áp dụng cho lịch đã CANCELLED.
    /// </summary>
    Task<CreateInterviewRequestResultDto> RescheduleAsync(
        long companyId, long userId, long applicationId, long scheduleId, RescheduleRequestDto dto);

    /// <summary>Hủy lịch: set CANCELLED + khóa mọi khung. Ghi nhật ký + email báo ứng viên (best-effort).</summary>
    Task CancelAsync(long companyId, long userId, long applicationId, long scheduleId, CancelScheduleDto dto);
}
