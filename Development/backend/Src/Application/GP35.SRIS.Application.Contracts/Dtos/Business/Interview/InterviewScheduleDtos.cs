namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>1 interviewer rút gọn (id + tên) — dùng trong SlotDto để Human Resource thấy panel.</summary>
public class InterviewerMiniDto
{
    public long InterviewerId { get; set; }
    public string FullName { get; set; } = null!;
    public string? Email { get; set; }
}

/// <summary>1 khung giờ Human Resource mở (panel 1..N interviewer + 1 thời điểm).</summary>
public class SlotInputDto
{
    /// <summary>Panel interviewer (1..5 người cùng dự buổi phỏng vấn). Docs Section 15 mở rộng A.</summary>
    public List<long> InterviewerIds { get; set; } = new();
    public DateTime StartTime { get; set; }
}

/// <summary>
/// Human Resource mở 1 POOL khung dùng chung cho 1 job + vòng (docs 15). Nhiều ứng viên được mời sẽ
/// cùng chọn từ bộ khung này.
/// </summary>
public class CreatePoolDto
{
    /// <summary>
    /// Vòng thứ mấy của vị trí. Null = vòng KẾ TIẾP (mặc định, FE luôn để hệ thống tự đánh).
    /// Truyền số của một vòng ĐÃ CÓ = mở thêm đợt khung cho vòng đó (ứng viên vào sau vẫn được
    /// phỏng vấn đúng vòng 1 dù người khác đã sang vòng 3). Nhảy cóc quá vòng kế tiếp bị chặn.
    /// </summary>
    public int? RoundNumber { get; set; }

    /// <summary>Tên vòng ("Phỏng vấn chuyên môn") — tùy chọn, tối đa 120 ký tự (V041).</summary>
    public string? Name { get; set; }

    public List<SlotInputDto> Slots { get; set; } = new();
}

/// <summary>Human Resource mời 1 danh sách ứng viên (application) vào 1 pool — mỗi người 1 magic link SCHEDULE.</summary>
public class InvitePoolDto
{
    public List<long> ApplicationIds { get; set; } = new();
}

/// <summary>Human Resource hủy pool. Lý do (tùy chọn) ghi nhật ký + email báo ứng viên đã chốt.</summary>
public class CancelPoolDto
{
    public string? Reason { get; set; }
}

/// <summary>
/// Human Resource chốt lịch TAY cho 1 ứng viên (nhánh gọi điện — không qua pool/magic link).
/// roundNumber null = tự đánh số vòng kế tiếp của hồ sơ.
/// </summary>
public class ManualConfirmDto
{
    /// <summary>Panel interviewer (1..5 người) — mở rộng A.</summary>
    public List<long> InterviewerIds { get; set; } = new();
    public DateTime StartTime { get; set; }

    /// <summary>
    /// Buổi thứ mấy của CHÍNH ứng viên này. Null = tự đánh vòng kế tiếp của hồ sơ (FE luôn bỏ
    /// trống). Nhảy cóc quá vòng kế tiếp bị chặn.
    /// </summary>
    public int? RoundNumber { get; set; }

    /// <summary>Tên vòng — tùy chọn; bỏ trống thì ghi "Chốt lịch tay" cho card tự giải thích.</summary>
    public string? Name { get; set; }
}

/// <summary>1 khung giờ (góc nhìn nội bộ — có panel interviewer + ứng viên đã đặt).</summary>
public class SlotDto
{
    public long SlotId { get; set; }
    public DateTime StartTime { get; set; }
    public string Status { get; set; } = null!;
    /// <summary>Ứng viên (application) đã đặt khung này; null khi còn OPEN.</summary>
    public long? BookedApplicationId { get; set; }
    /// <summary>Panel interviewer của khung (1..N người) — Human Resource xem tên.</summary>
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
    /// <summary>Tên vòng do Human Resource đặt; null = UI hiện "Vòng N".</summary>
    public string? Name { get; set; }
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
