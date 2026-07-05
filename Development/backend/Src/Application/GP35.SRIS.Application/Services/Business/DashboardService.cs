using GP35.SRIS.Application.Contracts.Dtos.Business.Dashboard;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
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
    private readonly ILogger _logger;

    public DashboardService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _repo = serviceProvider.GetRequiredService<IDashboardRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<DashboardService>();
    }

    public async Task<DashboardOverviewDto> GetOverviewAsync(long companyId, long? jobId)
    {
        var funnelRaw = await _repo.GetFunnelAsync(companyId, jobId);
        var rejectRaw = await _repo.GetRejectReasonsAsync(companyId, jobId);
        var sourceRaw = await _repo.GetSourceBreakdownAsync(companyId, jobId);
        var offerRaw = await _repo.GetOfferStatusCountsAsync(companyId, jobId);
        var hireDurations = await _repo.GetHireDurationDaysAsync(companyId, jobId);

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
            Sources = ToBreakdown(sourceRaw, "Không rõ")
        };
    }

    public async Task<KanbanBoardDto> GetKanbanBoardAsync(long companyId, long? jobId)
    {
        var cards = await _repo.GetKanbanCardsAsync(companyId, jobId);

        var kanbanStates = new[] { "NEW", "INTERVIEW", "QUIZ", "OFFER" };
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
                        AiMatchScore = c.AiMatchScore,
                        AppliedAt = c.AppliedAt,
                        StageUpdatedAt = c.StageUpdatedAt
                    })
                    .ToList()
            })
            .ToList();

        return new KanbanBoardDto { Columns = columns };
    }

    private static string GetStateLabel(string state) => state switch
    {
        "NEW" => "Applied",
        "INTERVIEW" => "Interview",
        "QUIZ" => "Làm Quiz",
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
