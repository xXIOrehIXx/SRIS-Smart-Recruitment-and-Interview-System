namespace GP35.SRIS.Application.Contracts.Dtos.Business.Dashboard;

/// <summary>1 bậc của phễu tuyển dụng (state + số hồ sơ).</summary>
public class FunnelStageDto
{
    public string State { get; set; } = null!;
    public int Count { get; set; }
}

/// <summary>1 dòng phân rã (lý do loại / nguồn ứng viên) kèm % trên tổng.</summary>
public class BreakdownItemDto
{
    public string Label { get; set; } = null!;
    public int Count { get; set; }
    public decimal Percentage { get; set; }
}

/// <summary>Các thẻ KPI tổng quan.</summary>
public class DashboardSummaryDto
{
    public int TotalApplications { get; set; }
    public int InPipeline { get; set; }          // chưa HIRED/REJECTED
    public int Hired { get; set; }
    public int Rejected { get; set; }
    public decimal ConversionRatePct { get; set; }       // hired / total
    public double? AvgTimeToHireDays { get; set; }        // null nếu chưa có ai HIRED

    public int OffersSent { get; set; }
    public int OffersAccepted { get; set; }
    public int OffersDeclined { get; set; }
    public int OffersPending { get; set; }
    public decimal? OfferAcceptanceRatePct { get; set; }  // accepted / (accepted + declined)
}

/// <summary>1 hồ sơ rút gọn cho các bảng "gần đây" trên dashboard.</summary>
public class RecentApplicationDto
{
    public long ApplicationId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string CandidateEmail { get; set; } = null!;
    public string JobTitle { get; set; } = null!;
    public string CurrentState { get; set; } = null!;
    public DateTime AppliedAt { get; set; }
    public DateTime? StageUpdatedAt { get; set; }
}

/// <summary>Tiến độ tuyển theo phòng ban: số HIRED / tổng hồ sơ.</summary>
public class DepartmentProgressDto
{
    public string Department { get; set; } = null!;
    public int Hired { get; set; }
    public int Total { get; set; }
}

/// <summary>1 dòng hoạt động gần đây (từ ActivityLog).</summary>
public class RecentActivityDto
{
    public long ApplicationId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string Action { get; set; } = null!;
    public string? FromState { get; set; }
    public string? ToState { get; set; }
    public DateTime? CreatedAt { get; set; }
}

/// <summary>Tổng quan Dashboard (docs 4, M7). jobId null = toàn công ty.</summary>
public class DashboardOverviewDto
{
    public long? JobId { get; set; }
    public DashboardSummaryDto Summary { get; set; } = new();
    public List<FunnelStageDto> Funnel { get; set; } = new();
    public List<BreakdownItemDto> RejectReasons { get; set; } = new();
    public List<BreakdownItemDto> Sources { get; set; } = new();

    /// <summary>Hồ sơ mới nộp gần nhất (bảng "Ứng viên ứng tuyển gần đây").</summary>
    public List<RecentApplicationDto> RecentApplications { get; set; } = new();
    /// <summary>Quyết định HIRED/REJECTED gần nhất (bảng "Quyết định gần đây" của DM).</summary>
    public List<RecentApplicationDto> RecentDecisions { get; set; } = new();
    /// <summary>Tiến độ theo phòng ban (job.department — danh mục V022).</summary>
    public List<DepartmentProgressDto> DepartmentProgress { get; set; } = new();
    /// <summary>Hoạt động gần đây toàn công ty (ActivityLog).</summary>
    public List<RecentActivityDto> RecentActivities { get; set; } = new();
}

/// <summary>1 item trong Kanban board (1 ứng viên).</summary>
public class KanbanCardDto
{
    public long ApplicationId { get; set; }
    public long CandidateId { get; set; }
    public string CandidateName { get; set; } = null!;
    public string CandidateEmail { get; set; } = null!;
    public string JobTitle { get; set; } = null!;
    public long JobId { get; set; }
    public string CurrentState { get; set; } = null!;
    public decimal? AiMatchScore { get; set; }
    public DateTime AppliedAt { get; set; }
    public DateTime? StageUpdatedAt { get; set; }
}

/// <summary>1 cột trong Kanban board (theo state).</summary>
public class KanbanColumnDto
{
    public string State { get; set; } = null!;
    public string StateLabel { get; set; } = null!;
    public int Count { get; set; }
    public List<KanbanCardDto> Cards { get; set; } = new();
}

/// <summary>Toàn bộ Kanban board.</summary>
public class KanbanBoardDto
{
    public List<KanbanColumnDto> Columns { get; set; } = new();
}
