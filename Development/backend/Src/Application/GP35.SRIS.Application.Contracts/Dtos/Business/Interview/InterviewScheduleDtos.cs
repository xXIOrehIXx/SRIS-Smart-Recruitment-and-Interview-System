namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>1 khung giờ Recruiter mở (gán interviewer + thời điểm).</summary>
public class SlotInputDto
{
    public long InterviewerId { get; set; }
    public DateTime StartTime { get; set; }
}

/// <summary>
/// Recruiter tạo Interview Request (1 vòng) cho hồ sơ đang ở INTERVIEW (KÉO trước, TẠO sau — 15.1).
/// roundNumber null = hệ thống tự đánh số vòng kế tiếp.
/// </summary>
public class CreateInterviewRequestDto
{
    public int? RoundNumber { get; set; }
    public List<SlotInputDto> Slots { get; set; } = new();
}

/// <summary>1 khung giờ (góc nhìn nội bộ — có interviewer).</summary>
public class SlotDto
{
    public long SlotId { get; set; }
    public long InterviewerId { get; set; }
    public DateTime StartTime { get; set; }
    public string Status { get; set; } = null!;
}

/// <summary>1 lịch phỏng vấn (1 vòng) kèm khung giờ.</summary>
public class InterviewScheduleDto
{
    public long ScheduleId { get; set; }
    public long ApplicationId { get; set; }
    public int RoundNumber { get; set; }
    public string Status { get; set; } = null!;
    public long? ConfirmedSlotId { get; set; }
    public List<SlotDto> Slots { get; set; } = new();
}

/// <summary>Kết quả tạo request: lịch vừa tạo + magic link SCHEDULE để gửi ứng viên (token gốc 1 lần).</summary>
public class CreateInterviewRequestResultDto
{
    public InterviewScheduleDto Schedule { get; set; } = null!;
    public string MagicToken { get; set; } = null!;
    public DateTime TokenExpiresAt { get; set; }
}
