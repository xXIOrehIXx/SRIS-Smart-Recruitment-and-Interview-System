using GP35.SRIS.Application.Contracts.Dtos.Business.Dashboard;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Dashboard / Analytics (docs 4, M7). Lắp số liệu từ <see cref="IDashboardRepo"/>: phễu theo state,
/// KPI card (time-to-hire, conversion, offer acceptance rate), phân rã lý do loại + nguồn ứng viên.
/// </summary>
public class DashboardService : BaseService<DashboardService>, IDashboardService
{
    private readonly IDashboardRepo _repo;
    private readonly IContextData _contextData;
    private readonly ILogger _logger;

    public DashboardService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _repo = serviceProvider.GetRequiredService<IDashboardRepo>();
        _contextData = serviceProvider.GetRequiredService<IContextData>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<DashboardService>();
    }

    /// <summary>
    /// Phạm vi dữ liệu của người đang đăng nhập (V023): DM chỉ thấy hồ sơ thuộc phòng ban mình
    /// phụ trách (repo lo lọc); Admin/Human Resource/Interviewer thấy toàn công ty -> null.
    /// </summary>
    private long? DepartmentScope =>
        string.Equals(_contextData.Role, RoleConstants.DepartmentManager, StringComparison.OrdinalIgnoreCase)
            ? _contextData.UserId
            : null;

    public async Task<DashboardOverviewDto> GetOverviewAsync(long companyId, long? jobId)
    {
        var scope = DepartmentScope;
        var funnelRaw = await _repo.GetFunnelAsync(companyId, jobId, scope);
        var rejectRaw = await _repo.GetRejectReasonsAsync(companyId, jobId, scope);
        var sourceRaw = await _repo.GetSourceBreakdownAsync(companyId, jobId, scope);
        var offerRaw = await _repo.GetOfferStatusCountsAsync(companyId, jobId, scope);
        var hireDurations = await _repo.GetHireDurationDaysAsync(companyId, jobId, scope);
        var recentApps = await _repo.GetRecentApplicationsAsync(companyId, jobId, 8, scope);
        var recentDecisions = await _repo.GetRecentDecisionsAsync(companyId, jobId, 5, scope);
        var departmentProgress = await _repo.GetDepartmentProgressAsync(companyId, scope);
        var recentActivities = await _repo.GetRecentActivitiesAsync(companyId, jobId, 8, scope);
        var recentRejections = await _repo.GetRecentRejectionsAsync(companyId, jobId, 6, scope);

        var byState = funnelRaw.ToDictionary(x => x.State, x => x.Count, StringComparer.OrdinalIgnoreCase);
        int CountOf(string state) => byState.TryGetValue(state, out var c) ? c : 0;

        // Phễu theo đúng thứ tự state (điền 0 cho state chưa có hồ sơ).
        var funnel = ApplicationState.All
            .Select(s => new FunnelStageDto { State = s, Count = CountOf(s) })
            .ToList();

        var total = funnelRaw.Sum(x => x.Count);
        var hired = CountOf(ApplicationState.Hired);
        var rejected = CountOf(ApplicationState.Rejected);
        var inPipeline = total - hired - rejected;

        var offerByStatus = offerRaw.ToDictionary(x => x.Label ?? "", x => x.Count, StringComparer.OrdinalIgnoreCase);
        int OfferOf(string s) => offerByStatus.TryGetValue(s, out var c) ? c : 0;
        var accepted = OfferOf(OfferStatus.Accepted);
        var declined = OfferOf(OfferStatus.Declined);
        var pending = OfferOf(OfferStatus.Pending);
        var responded = accepted + declined;

        var summary = new DashboardSummaryDto
        {
            TotalApplications = total,
            InPipeline = inPipeline,
            Hired = hired,
            Rejected = rejected,
            ConversionRatePct = Pct(hired, total),
            AvgTimeToHireDays = hireDurations.Count == 0 ? null : Math.Round(hireDurations.Average(), 1),
            OffersSent = accepted + declined + pending,
            OffersAccepted = accepted,
            OffersDeclined = declined,
            OffersPending = pending,
            OfferAcceptanceRatePct = responded == 0 ? null : Pct(accepted, responded)
        };

        _logger.Information("Dashboard: overview job={JobId} total={Total} hired={Hired}.", jobId, total, hired);

        return new DashboardOverviewDto
        {
            JobId = jobId,
            Summary = summary,
            Funnel = funnel,
            RejectReasons = ToBreakdown(rejectRaw, "Không rõ"),
            Sources = ToBreakdown(sourceRaw, "Không rõ"),
            RecentRejections = recentRejections
                .Select(r => new RecentRejectionDto
                {
                    ApplicationId = r.ApplicationId,
                    CandidateName = r.CandidateName,
                    JobTitle = r.JobTitle,
                    RejectReason = r.RejectReason,
                    RejectedAt = r.RejectedAt,
                    RejectedFromState = r.RejectedFromState
                })
                .ToList(),
            RecentApplications = recentApps.Select(ToRecent).ToList(),
            RecentDecisions = recentDecisions.Select(ToRecent).ToList(),
            DepartmentProgress = departmentProgress
                .Select(d => new DepartmentProgressDto { Department = d.Department, Hired = d.Hired, Total = d.Total })
                .ToList(),
            RecentActivities = recentActivities
                .Select(a => new RecentActivityDto
                {
                    ApplicationId = a.ApplicationId,
                    CandidateName = a.CandidateName,
                    Action = a.Action,
                    FromState = a.FromState,
                    ToState = a.ToState,
                    CreatedAt = a.CreatedAt
                })
                .ToList()
        };
    }

    private static RecentApplicationDto ToRecent(KanbanCard c) => new()
    {
        ApplicationId = c.ApplicationId,
        CandidateName = c.CandidateName,
        CandidateEmail = c.CandidateEmail,
        JobTitle = c.JobTitle,
        CurrentState = c.CurrentState,
        AppliedAt = c.AppliedAt,
        StageUpdatedAt = c.StageUpdatedAt
    };

    public async Task<KanbanBoardDto> GetKanbanBoardAsync(long companyId, long? jobId)
    {
        var cards = await _repo.GetKanbanCardsAsync(companyId, jobId, DepartmentScope);

        // 4 pha hiển thị của pipeline (QUIZ đã loại khỏi scope 07/2026)
        var kanbanStates = new[] { "NEW", "SCREENING", "INTERVIEW", "OFFER" };
        var columns = kanbanStates
            .Select(state => new KanbanColumnDto
            {
                State = state,
                StateLabel = GetStateLabel(state),
                Count = cards.Count(c => c.CurrentState == state),
                Cards = cards
                    .Where(c => c.CurrentState == state)
                    .Select(c => new KanbanCardDto
                    {
                        ApplicationId = c.ApplicationId,
                        CandidateId = c.CandidateId,
                        CandidateName = c.CandidateName,
                        CandidateEmail = c.CandidateEmail,
                        JobTitle = c.JobTitle,
                        JobId = c.JobId,
                        CurrentState = c.CurrentState,
                        AppliedAt = c.AppliedAt,
                        StageUpdatedAt = c.StageUpdatedAt,
                        Department = c.Department,
                        DepartmentManagerId = c.DepartmentManagerId
                    })
                    .ToList()
            })
            .ToList();

        return new KanbanBoardDto { Columns = columns };
    }

    private static string GetStateLabel(string state) => state switch
    {
        "NEW" => "Hồ sơ mới",
        "SCREENING" => "Sàng lọc",
        "INTERVIEW" => "Phỏng vấn",
        "OFFER" => "Offer",
        _ => state
    };

    // ============================================================

    private static List<BreakdownItemDto> ToBreakdown(IReadOnlyList<LabelCount> rows, string nullLabel)
    {
        var sum = rows.Sum(r => r.Count);
        return rows
            .OrderByDescending(r => r.Count)
            .Select(r => new BreakdownItemDto
            {
                Label = string.IsNullOrWhiteSpace(r.Label) ? nullLabel : r.Label!,
                Count = r.Count,
                Percentage = Pct(r.Count, sum)
            })
            .ToList();
    }

    private static decimal Pct(int part, int whole) =>
        whole == 0 ? 0m : Math.Round((decimal)part * 100m / whole, 1);
}
