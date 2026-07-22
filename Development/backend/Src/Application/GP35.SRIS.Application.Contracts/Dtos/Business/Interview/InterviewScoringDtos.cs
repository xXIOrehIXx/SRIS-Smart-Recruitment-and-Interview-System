namespace GP35.SRIS.Application.Contracts.Dtos.Business.Interview;

/// <summary>1 buổi được giao cho interviewer (danh sách buổi cần chấm — 5.7).</summary>
public class MyScheduleDto
{
    public long ScheduleId { get; set; }
    public long ApplicationId { get; set; }
    public int RoundNumber { get; set; }
    public string Status { get; set; } = null!;

    /// <summary>
    /// Trạng thái phiếu chấm của CHÍNH interviewer này cho buổi:
    /// NOT_STARTED | DRAFT | SUBMITTED. FE dùng để phân biệt "đã nộp / đang nháp / chưa chấm".
    /// </summary>
    public string MySheetStatus { get; set; } = "NOT_STARTED";

    /// <summary>Giờ hẹn (khung đã chốt).</summary>
    public DateTime StartTime { get; set; }
    public string CandidateName { get; set; } = null!;
    public string CandidateEmail { get; set; } = null!;
    public string JobTitle { get; set; } = null!;
}

/// <summary>1 dòng interviewer nhập điểm + note cho 1 tiêu chí.</summary>
public class ScoreItemInputDto
{
    public long CriteriaId { get; set; }
    public decimal? Score { get; set; }
    public string? Note { get; set; }
}

/// <summary>Lưu nháp cả phiếu (nhiều tiêu chí một lần).</summary>
public class SaveScoreDraftDto
{
    public List<ScoreItemInputDto> Items { get; set; } = new();
}

/// <summary>1 tiêu chí trên phiếu chấm của CHÍNH interviewer (kèm điểm/note của họ nếu có).</summary>
public class ScoringSheetCriterionDto
{
    public long CriteriaId { get; set; }
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; }
    public decimal MaxScore { get; set; }
    public decimal? MyScore { get; set; }
    public string? MyNote { get; set; }
}

/// <summary>Phiếu chấm của interviewer cho 1 buổi (chỉ thấy điểm CỦA MÌNH — Blind Review).</summary>
public class ScoringSheetDto
{
    public long ScheduleId { get; set; }

    /// <summary>NOT_STARTED | DRAFT | SUBMITTED (trạng thái phiếu của chính interviewer này).</summary>
    public string MyStatus { get; set; } = null!;

    public List<ScoringSheetCriterionDto> Criteria { get; set; } = new();
}

// ----- Tổng hợp panel (sau khi đã SUBMITTED — blind mở) -----

/// <summary>Điểm + note của 1 interviewer cho 1 tiêu chí (chỉ phiếu đã nộp).</summary>
public class InterviewerScoreDto
{
    public long InterviewerId { get; set; }
    public decimal? Score { get; set; }
    public string? Note { get; set; }
}

/// <summary>Tổng hợp 1 tiêu chí: trung bình + độ lệch chuẩn (đo đồng thuận) + cờ "cần bàn".</summary>
public class AggregateCriterionDto
{
    public long CriteriaId { get; set; }
    public string Name { get; set; } = null!;
    public decimal Weight { get; set; }
    public decimal MaxScore { get; set; }

    /// <summary>Trung bình điểm các interviewer (1 trục của Radar Chart).</summary>
    public decimal Average { get; set; }

    /// <summary>Độ lệch chuẩn — thấp = đồng thuận; cao = panel bất đồng.</summary>
    public decimal StdDev { get; set; }

    /// <summary>True nếu std dev vượt ngưỡng -> flag "cần bàn" (5.7).</summary>
    public bool NeedsDiscussion { get; set; }

    public List<InterviewerScoreDto> Scores { get; set; } = new();
}

/// <summary>Điểm tổng có trọng số của 1 interviewer trên cả phiếu.</summary>
public class InterviewerTotalDto
{
    public long InterviewerId { get; set; }
    public decimal WeightedTotal { get; set; }
}

/// <summary>Bảng tổng hợp 1 buổi: Radar (average từng tiêu chí) + std dev + điểm từng interviewer.</summary>
public class ScheduleAggregateDto
{
    public long ScheduleId { get; set; }
    public int SubmittedInterviewers { get; set; }
    public List<AggregateCriterionDto> Criteria { get; set; } = new();
    public List<InterviewerTotalDto> InterviewerTotals { get; set; } = new();

    /// <summary>Trung bình điểm tổng có trọng số của cả panel.</summary>
    public decimal PanelWeightedAverage { get; set; }
}
