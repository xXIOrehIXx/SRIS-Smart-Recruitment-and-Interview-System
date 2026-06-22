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

/// <summary>Tổng quan Dashboard (docs 4, M7). jobId null = toàn công ty.</summary>
public class DashboardOverviewDto
{
    public long? JobId { get; set; }
    public DashboardSummaryDto Summary { get; set; } = new();
    public List<FunnelStageDto> Funnel { get; set; } = new();
    public List<BreakdownItemDto> RejectReasons { get; set; } = new();
    public List<BreakdownItemDto> Sources { get; set; } = new();
}
