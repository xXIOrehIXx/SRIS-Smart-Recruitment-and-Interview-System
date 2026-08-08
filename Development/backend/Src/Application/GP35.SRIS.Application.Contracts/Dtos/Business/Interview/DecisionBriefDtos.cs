namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>1 note theo tiêu chí mà người phỏng vấn để lại (KHÔNG kèm điểm — 5.14).</summary>
public class CriterionNoteDto
{
    public string CriteriaName { get; set; } = null!;
    public string Note { get; set; } = null!;
}

/// <summary>Kết luận của MỘT người phỏng vấn: nên tuyển hay không + vì sao.</summary>
public class InterviewerVerdictDto
{
    public long InterviewerId { get; set; }
    public string? InterviewerName { get; set; }

    /// <summary>STRONG_HIRE | HIRE | CONSIDER | NO_HIRE. Null = nộp điểm nhưng chưa ghi kết luận.</summary>
    public string? Recommendation { get; set; }

    /// <summary>Nhận xét tổng — lý do chính để người quyết đọc.</summary>
    public string? Summary { get; set; }

    public DateTime? SubmittedAt { get; set; }

    /// <summary>Các note theo từng tiêu chí của chính người này (bỏ tiêu chí không ghi gì).</summary>
    public List<CriterionNoteDto> Notes { get; set; } = new();
}

/// <summary>1 vòng phỏng vấn, gom kết luận của cả panel.</summary>
public class DecisionRoundDto
{
    public long ScheduleId { get; set; }
    public int RoundNumber { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public string? ScheduleStatus { get; set; }

    /// <summary>Số người đã NỘP phiếu ở vòng này (blind đã mở). 0 = chưa có gì để đọc.</summary>
    public int SubmittedInterviewers { get; set; }

    public List<InterviewerVerdictDto> Verdicts { get; set; } = new();
}

/// <summary>Ghi chú nội bộ của Human Resource về hồ sơ — bối cảnh thêm cho người quyết.</summary>
public class DecisionNoteDto
{
    public string? AuthorName { get; set; }
    public string Content { get; set; } = null!;
    public DateTime? CreatedAt { get; set; }
}

/// <summary>
/// Bản tóm tắt để NGƯỜI QUYẾT TUYỂN chốt (docs 5.14): ứng viên là ai, cả panel kết luận
/// thế nào và VÌ SAO. Cố tình KHÔNG có điểm số — người quyết đọc nhận xét rồi bấm
/// tuyển/loại, không phải nhìn trung bình có trọng số rồi tự dịch ra ý người chấm.
/// </summary>
public class DecisionBriefDto
{
    public long ApplicationId { get; set; }
    public string CurrentState { get; set; } = null!;
    public DateTime? AppliedAt { get; set; }

    public long CandidateId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string? CandidateEmail { get; set; }
    public string? CandidatePhone { get; set; }

    public long JobId { get; set; }
    public string JobTitle { get; set; } = null!;
    public string? Department { get; set; }

    public long CvId { get; set; }
    public string? CvFileName { get; set; }

    /// <summary>Đếm nhanh trên MỌI vòng: gật (mạnh + thường) / cân nhắc / lắc đầu.</summary>
    public int HireCount { get; set; }
    public int ConsiderCount { get; set; }
    public int NoHireCount { get; set; }

    /// <summary>Tổng phiếu đã nộp (gồm cả phiếu cũ chưa có kết luận).</summary>
    public int TotalSubmitted { get; set; }

    public List<DecisionRoundDto> Rounds { get; set; } = new();
    public List<DecisionNoteDto> InternalNotes { get; set; } = new();
}
