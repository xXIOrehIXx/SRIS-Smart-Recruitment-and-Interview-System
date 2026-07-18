namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>1 interviewer rút gọn (id + tên) — dùng trong SlotDto để Recruiter thấy panel.</summary>
public class InterviewerMiniDto
{
    public long InterviewerId { get; set; }
    public string FullName { get; set; } = null!;
    public string? Email { get; set; }
}

/// <summary>1 khung giờ Recruiter mở (panel 1..N interviewer + 1 thời điểm).</summary>
public class SlotInputDto
{
    /// <summary>Panel interviewer (1..5 người cùng dự buổi phỏng vấn). Docs Section 15 mở rộng A.</summary>
    public List<long> InterviewerIds { get; set; } = new();
    public DateTime StartTime { get; set; }
}

/// <summary>
/// Recruiter mở 1 POOL khung dùng chung cho 1 job + vòng (docs 15). Nhiều ứng viên được mời sẽ
/// cùng chọn từ bộ khung này. roundNumber null = vòng 1.
/// </summary>
public class CreatePoolDto
{
    public int? RoundNumber { get; set; }
    public List<SlotInputDto> Slots { get; set; } = new();
}

/// <summary>Recruiter mời 1 danh sách ứng viên (application) vào 1 pool — mỗi người 1 magic link SCHEDULE.</summary>
public class InvitePoolDto
{
    public List<long> ApplicationIds { get; set; } = new();
}

/// <summary>Recruiter hủy pool. Lý do (tùy chọn) ghi nhật ký + email báo ứng viên đã chốt.</summary>
public class CancelPoolDto
{
    public string? Reason { get; set; }
}

/// <summary>
/// Recruiter chốt lịch TAY cho 1 ứng viên (nhánh gọi điện — không qua pool/magic link).
/// roundNumber null = tự đánh số vòng kế tiếp của hồ sơ.
/// </summary>
public class ManualConfirmDto
{
    /// <summary>Panel interviewer (1..5 người) — mở rộng A.</summary>
    public List<long> InterviewerIds { get; set; } = new();
    public DateTime StartTime { get; set; }
    public int? RoundNumber { get; set; }
}

/// <summary>1 khung giờ (góc nhìn nội bộ — có panel interviewer + ứng viên đã đặt).</summary>
public class SlotDto
{
    public long SlotId { get; set; }
    public DateTime StartTime { get; set; }
    public string Status { get; set; } = null!;
    /// <summary>Ứng viên (application) đã đặt khung này; null khi còn OPEN.</summary>
    public long? BookedApplicationId { get; set; }
    /// <summary>Panel interviewer của khung (1..N người) — Recruiter xem tên.</summary>
    public List<InterviewerMiniDto> Interviewers { get; set; } = new();
}

/// <summary>1 ứng viên đã được mời vào pool + trạng thái + cờ nhắc (vàng/đỏ khi báo bận nhiều lần).</summary>
public class InvitedCandidateDto
{
    public long ScheduleId { get; set; }
    public long ApplicationId { get; set; }
    public string Status { get; set; } = null!;
    public long? ConfirmedSlotId { get; set; }
    /// <summary>Số lần hồ sơ này báo bận (mọi vòng).</summary>
    public int NoSlotFitsCount { get; set; }
    /// <summary>NONE / YELLOW / RED — nhắc recruiter gọi điện chốt tay.</summary>
    public string Flag { get; set; } = null!;
}

/// <summary>1 pool khung dùng chung kèm khung + danh sách ứng viên đã mời.</summary>
public class PoolDto
{
    public long PoolId { get; set; }
    public long JobId { get; set; }
    public int RoundNumber { get; set; }
    public string Status { get; set; } = null!;
    public List<SlotDto> Slots { get; set; } = new();
    public List<InvitedCandidateDto> InvitedCandidates { get; set; } = new();
}

/// <summary>1 ứng viên đã mời thành công (kèm magic link SCHEDULE — token gốc chỉ có 1 lần ở đây).</summary>
public class InviteResultItemDto
{
    public long ApplicationId { get; set; }
    public long ScheduleId { get; set; }
    public string MagicToken { get; set; } = null!;
    public DateTime TokenExpiresAt { get; set; }
}

/// <summary>1 ứng viên bị bỏ qua khi mời (không ở INTERVIEW / đã mời rồi) + lý do.</summary>
public class InviteSkippedDto
{
    public long ApplicationId { get; set; }
    public string Reason { get; set; } = null!;
}

/// <summary>Kết quả mời: danh sách mời thành công + danh sách bỏ qua.</summary>
public class InviteResultDto
{
    public List<InviteResultItemDto> Invited { get; set; } = new();
    public List<InviteSkippedDto> Skipped { get; set; } = new();
}
