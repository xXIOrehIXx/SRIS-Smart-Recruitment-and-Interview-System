namespace GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

/// <summary>
/// 1 card ứng viên trên Kanban (5.16). FE tự nhóm theo <see cref="CurrentState"/> vào 4 pha hiển thị:
/// NEW=Hồ sơ mới · SCREENING=Sàng lọc · INTERVIEW=Phỏng vấn · OFFER/HIRED/REJECTED=Quyết định.
/// </summary>
public class ApplicationCardDto
{
    public long ApplicationId { get; set; }
    public long CandidateId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string CandidateEmail { get; set; } = null!;
    public string CurrentState { get; set; } = null!;
    /// <summary>Điểm cả-CV (0-100). Null = chưa chấm xong (đang PENDING).</summary>
    public decimal? AiMatchScore { get; set; }
    /// <summary>Điểm theo tiêu chí (0-100 — 5.18). Null = job chưa có tiêu chí / chưa chấm.</summary>
    public decimal? CriteriaScore { get; set; }
    public long CvId { get; set; }
    public DateTime? AppliedAt { get; set; }
}

/// <summary>Toàn bộ hồ sơ của 1 job cho màn Kanban.</summary>
public class ApplicationBoardDto
{
    public long JobId { get; set; }
    public List<ApplicationCardDto> Applications { get; set; } = new();
}

/// <summary>Chi tiết 1 hồ sơ cho màn xem ứng viên (không lộ điểm phỏng vấn khi chưa submit — blind review 5.7).</summary>
public class ApplicationDetailDto
{
    public long ApplicationId { get; set; }
    public string CurrentState { get; set; } = null!;
    public decimal? AiMatchScore { get; set; }
    public decimal? CriteriaScore { get; set; }
    public string? RejectReason { get; set; }
    public DateTime? AppliedAt { get; set; }
    public DateTime? StageUpdatedAt { get; set; }

    public long CandidateId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string CandidateEmail { get; set; } = null!;
    public string? CandidatePhone { get; set; }
    public string? CandidateSource { get; set; }

    public long JobId { get; set; }
    public string JobTitle { get; set; } = null!;

    public long CvId { get; set; }
    public string? CvFileName { get; set; }
    public string CvParseStatus { get; set; } = null!;
}
