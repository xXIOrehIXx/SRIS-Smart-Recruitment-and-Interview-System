using GP35.SRIS.Application.Contracts.Dtos.Candidate.Schedule;

namespace GP35.SRIS.Application.Contracts.Services.CandidatePortal;

/// <summary>
/// Ứng viên chọn/xác nhận lịch phỏng vấn qua magic link SCHEDULE (docs 15). Không login.
/// Chốt khung bằng khóa lạc quan (ai trước được trước — 15.3); one-time đốt token khi chốt.
/// </summary>
public interface ICandidateScheduleService : IBaseService
{
    /// <summary>Trang chọn lịch: trạng thái + các khung còn chọn được (OPEN + tương lai).</summary>
    Task<CandidateScheduleDto> GetScheduleAsync(string rawToken);

    /// <summary>Chốt 1 khung. Trả lỗi 409 nếu khung vừa bị người khác đặt / đã khóa.</summary>
    Task<ScheduleConfirmationDto> ConfirmAsync(string rawToken, ConfirmSlotDto dto);

    /// <summary>"Không khung nào phù hợp" -> lịch chuyển NO_SLOT_FITS, đốt token (Recruiter mở vòng mới).</summary>
    Task NoSlotFitsAsync(string rawToken);
}
