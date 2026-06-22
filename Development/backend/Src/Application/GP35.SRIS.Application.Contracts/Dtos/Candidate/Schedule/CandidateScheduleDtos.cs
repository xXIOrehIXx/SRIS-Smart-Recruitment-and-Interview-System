namespace GP35.SRIS.Application.Contracts.Dtos.Candidate.Schedule;

/// <summary>1 khung giờ hiển thị cho ứng viên — chỉ thời điểm, KHÔNG lộ danh tính interviewer.</summary>
public class CandidateSlotDto
{
    public long SlotId { get; set; }
    public DateTime StartTime { get; set; }
}

/// <summary>
/// Trang chọn lịch của ứng viên: trạng thái lịch + các khung còn chọn được (OPEN + tương lai).
/// Nếu đã CONFIRMED thì Slots rỗng, ConfirmedSlot có giá trị.
/// </summary>
public class CandidateScheduleDto
{
    public long ScheduleId { get; set; }
    public int RoundNumber { get; set; }

    /// <summary>PENDING | CONFIRMED | NO_SLOT_FITS | CANCELLED</summary>
    public string Status { get; set; } = null!;

    public List<CandidateSlotDto> Slots { get; set; } = new();
    public CandidateSlotDto? ConfirmedSlot { get; set; }
}

/// <summary>Ứng viên chốt 1 khung.</summary>
public class ConfirmSlotDto
{
    public long SlotId { get; set; }
}

/// <summary>Kết quả sau khi chốt khung.</summary>
public class ScheduleConfirmationDto
{
    public long ScheduleId { get; set; }
    public long SlotId { get; set; }
    public DateTime StartTime { get; set; }
    public string Status { get; set; } = null!;
}
