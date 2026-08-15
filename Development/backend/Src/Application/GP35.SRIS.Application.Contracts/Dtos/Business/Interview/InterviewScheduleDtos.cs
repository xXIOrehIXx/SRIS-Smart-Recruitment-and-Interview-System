namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>1 interviewer rút gọn (id + tên) — để bộ phận nhân sự thấy panel của buổi.</summary>
public class InterviewerMiniDto
{
    public long InterviewerId { get; set; }
    public string FullName { get; set; } = null!;
    public string? Email { get; set; }
}

/// <summary>
/// Bộ phận nhân sự ĐẶT một buổi phỏng vấn đã thống nhất qua điện thoại (docs Section 15 —
/// viết lại 15/08/2026). Không còn mở khung cho ứng viên tự chọn: nhân sự gọi cho người phỏng
/// vấn và ứng viên, chốt giờ, rồi nhập vào đây.
/// </summary>
public class BookInterviewDto
{
    /// <summary>Panel interviewer (1..5 người cùng dự buổi phỏng vấn).</summary>
    public List<long> InterviewerIds { get; set; } = new();

    public DateTime StartTime { get; set; }

    /// <summary>
    /// Buổi thứ mấy của CHÍNH ứng viên này. Null = tự đánh vòng kế tiếp của hồ sơ (FE luôn bỏ
    /// trống). Nhảy cóc quá vòng kế tiếp bị chặn.
    /// </summary>
    public int? RoundNumber { get; set; }

    /// <summary>Tên vòng ("Phỏng vấn chuyên môn") — tùy chọn, tối đa 120 ký tự (V041).</summary>
    public string? Name { get; set; }
}

/// <summary>Hủy 1 buổi phỏng vấn. Lý do (tùy chọn) ghi nhật ký + email báo ứng viên.</summary>
public class CancelInterviewDto
{
    public string? Reason { get; set; }
}

/// <summary>1 buổi phỏng vấn đã đặt (góc nhìn của bộ phận nhân sự).</summary>
public class InterviewSessionDto
{
    public long ScheduleId { get; set; }
    public long ApplicationId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string CandidateEmail { get; set; } = null!;

    public int RoundNumber { get; set; }
    /// <summary>Tên vòng do nhân sự đặt; null = UI hiện "Vòng N".</summary>
    public string? RoundName { get; set; }

    public DateTime StartTime { get; set; }

    /// <summary>CONFIRMED | CANCELLED.</summary>
    public string Status { get; set; } = null!;

    /// <summary>Trạng thái hồ sơ — buổi của hồ sơ đã sang bước khác thì không sửa nữa.</summary>
    public string ApplicationState { get; set; } = null!;

    public List<InterviewerMiniDto> Interviewers { get; set; } = new();
}
