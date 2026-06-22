using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Collaborative Scoring (5.7). Blind Review: phiếu của người khác chỉ lộ khi đã SUBMITTED;
/// trang chấm của 1 interviewer chỉ thấy điểm của chính họ. Tổng hợp = Radar + std dev (đồng thuận).
/// </summary>
public class InterviewScoringService : BaseService<InterviewScoringService>, IInterviewScoringService
{
    // Std dev vượt ngưỡng (theo % thang điểm tiêu chí) -> flag "cần bàn" (5.7).
    private const decimal DiscussionStdDevFactor = 0.20m;

    private readonly ISchedulingRepo _schedulingRepo;
    private readonly IApplicationRepo _appRepo;
    private readonly IEvaluationCriteriaRepo _criteriaRepo;
    private readonly IInterviewScoreRepo _scoreRepo;
    private readonly ILogger _logger;

    public InterviewScoringService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _schedulingRepo = serviceProvider.GetRequiredService<ISchedulingRepo>();
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _criteriaRepo = serviceProvider.GetRequiredService<IEvaluationCriteriaRepo>();
        _scoreRepo = serviceProvider.GetRequiredService<IInterviewScoreRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<InterviewScoringService>();
    }

    public async Task<IReadOnlyList<MyScheduleDto>> GetMySchedulesAsync(long companyId, long interviewerId)
    {
        var schedules = await _schedulingRepo.GetSchedulesForInterviewerAsync(companyId, interviewerId);
        return schedules.Select(s => new MyScheduleDto
        {
            ScheduleId = s.ScheduleId,
            ApplicationId = s.ApplicationId,
            RoundNumber = s.RoundNumber,
            Status = s.Status
        }).ToList();
    }

    public async Task<ScoringSheetDto> GetSheetAsync(long companyId, long interviewerId, long scheduleId)
    {
        await EnsureAssignedAsync(companyId, scheduleId, interviewerId);
        var criteria = await GetActiveCriteriaAsync(companyId, scheduleId);
        var mine = await _scoreRepo.GetByScheduleAndInterviewerAsync(companyId, scheduleId, interviewerId);
        return BuildSheet(scheduleId, criteria, mine);
    }

    public async Task<ScoringSheetDto> SaveDraftAsync(
        long companyId, long interviewerId, long scheduleId, SaveScoreDraftDto dto)
    {
        await EnsureAssignedAsync(companyId, scheduleId, interviewerId);
        var criteria = await GetActiveCriteriaAsync(companyId, scheduleId);
        var byId = criteria.ToDictionary(c => c.CriteriaId);

        foreach (var item in dto.Items ?? new())
        {
            if (!byId.TryGetValue(item.CriteriaId, out var crit))
                throw Bad($"Tiêu chí (criteria_id={item.CriteriaId}) không thuộc job này.");
            if (item.Score is decimal sc && (sc < 0 || sc > crit.MaxScore))
                throw Bad($"Điểm tiêu chí '{crit.Name}' phải trong khoảng 0–{crit.MaxScore}.");

            await _scoreRepo.UpsertAsync(companyId, scheduleId, interviewerId, item.CriteriaId, item.Score, item.Note);
        }

        var mine = await _scoreRepo.GetByScheduleAndInterviewerAsync(companyId, scheduleId, interviewerId);
        return BuildSheet(scheduleId, criteria, mine);
    }

    public async Task<ScoringSheetDto> SubmitAsync(long companyId, long interviewerId, long scheduleId)
    {
        await EnsureAssignedAsync(companyId, scheduleId, interviewerId);
        var criteria = await GetActiveCriteriaAsync(companyId, scheduleId);
        if (criteria.Count == 0)
            throw Conflict("Job chưa có tiêu chí chấm nào — Recruiter cần cấu hình trước.");

        var mine = await _scoreRepo.GetByScheduleAndInterviewerAsync(companyId, scheduleId, interviewerId);
        var scored = mine.Where(s => s.Score is not null).Select(s => s.CriteriaId).ToHashSet();

        var missing = criteria.Where(c => !scored.Contains(c.CriteriaId)).ToList();
        if (missing.Count > 0)
            throw Bad($"Hãy chấm đủ điểm trước khi nộp. Còn thiếu: {string.Join(", ", missing.Select(c => c.Name))}.");

        await _scoreRepo.SubmitAsync(companyId, scheduleId, interviewerId);
        _logger.Information("Scoring: interviewer {InterviewerId} nộp phiếu buổi {ScheduleId} (mở blind).",
            interviewerId, scheduleId);

        var refreshed = await _scoreRepo.GetByScheduleAndInterviewerAsync(companyId, scheduleId, interviewerId);
        return BuildSheet(scheduleId, criteria, refreshed);
    }

    public async Task<ScheduleAggregateDto> GetAggregateAsync(long companyId, long scheduleId)
    {
        var criteria = await GetActiveCriteriaAsync(companyId, scheduleId);
        // BLIND REVIEW: chỉ phiếu đã nộp (repo đã lọc SUBMITTED).
        var submitted = await _scoreRepo.GetSubmittedByScheduleAsync(companyId, scheduleId);

        var interviewerIds = submitted.Select(s => s.InterviewerId).Distinct().ToList();

        var critDtos = new List<AggregateCriterionDto>();
        foreach (var c in criteria)
        {
            var rows = submitted.Where(s => s.CriteriaId == c.CriteriaId).ToList();
            var values = rows.Where(r => r.Score is not null).Select(r => (double)r.Score!.Value).ToList();

            var avg = values.Count == 0 ? 0.0 : values.Average();
            var std = StdDevPopulation(values);
            var needsDiscussion = values.Count >= 2 && (decimal)std > DiscussionStdDevFactor * c.MaxScore;

            critDtos.Add(new AggregateCriterionDto
            {
                CriteriaId = c.CriteriaId,
                Name = c.Name,
                Weight = c.Weight,
                MaxScore = c.MaxScore,
                Average = Round(avg),
                StdDev = Round(std),
                NeedsDiscussion = needsDiscussion,
                Scores = rows.Select(r => new InterviewerScoreDto
                {
                    InterviewerId = r.InterviewerId,
                    Score = r.Score,
                    Note = r.Note
                }).ToList()
            });
        }

        // Điểm tổng có trọng số từng interviewer (chỉ tính tiêu chí họ đã chấm).
        var weightById = criteria.ToDictionary(c => c.CriteriaId, c => c.Weight);
        var totals = new List<InterviewerTotalDto>();
        foreach (var id in interviewerIds)
        {
            var rows = submitted.Where(s => s.InterviewerId == id && s.Score is not null).ToList();
            decimal weightSum = 0, weighted = 0;
            foreach (var r in rows)
            {
                if (!weightById.TryGetValue(r.CriteriaId, out var w)) continue;
                weighted += r.Score!.Value * w;
                weightSum += w;
            }
            totals.Add(new InterviewerTotalDto
            {
                InterviewerId = id,
                WeightedTotal = weightSum == 0 ? 0 : Math.Round(weighted / weightSum, 2)
            });
        }

        var panelAvg = totals.Count == 0 ? 0m : Math.Round(totals.Average(t => t.WeightedTotal), 2);

        return new ScheduleAggregateDto
        {
            ScheduleId = scheduleId,
            SubmittedInterviewers = interviewerIds.Count,
            Criteria = critDtos,
            InterviewerTotals = totals,
            PanelWeightedAverage = panelAvg
        };
    }

    // ============================================================

    private async Task EnsureAssignedAsync(long companyId, long scheduleId, long interviewerId)
    {
        var assigned = await _schedulingRepo.IsInterviewerOnScheduleAsync(companyId, scheduleId, interviewerId);
        if (!assigned)
            throw Forbidden("Bạn không được giao chấm buổi phỏng vấn này.");
    }

    private async Task<IReadOnlyList<EvaluationCriteria>> GetActiveCriteriaAsync(long companyId, long scheduleId)
    {
        var schedule = await _schedulingRepo.GetScheduleByIdAsync(companyId, scheduleId)
            ?? throw NotFound($"Không tìm thấy buổi phỏng vấn (schedule_id={scheduleId}).");
        var app = await _appRepo.GetByIdAsync(companyId, schedule.ApplicationId)
            ?? throw NotFound("Không tìm thấy hồ sơ của buổi phỏng vấn.");
        return await _criteriaRepo.GetByJobAsync(companyId, app.JobId, activeOnly: true);
    }

    private static ScoringSheetDto BuildSheet(
        long scheduleId, IReadOnlyList<EvaluationCriteria> criteria, IReadOnlyList<InterviewScore> mine)
    {
        var byId = mine.ToDictionary(s => s.CriteriaId);
        string myStatus =
            mine.Count == 0 ? "NOT_STARTED" :
            mine.Any(s => string.Equals(s.Status, InterviewScoreStatus.Submitted, StringComparison.OrdinalIgnoreCase))
                ? InterviewScoreStatus.Submitted : InterviewScoreStatus.Draft;

        return new ScoringSheetDto
        {
            ScheduleId = scheduleId,
            MyStatus = myStatus,
            Criteria = criteria.Select(c =>
            {
                byId.TryGetValue(c.CriteriaId, out var mineRow);
                return new ScoringSheetCriterionDto
                {
                    CriteriaId = c.CriteriaId,
                    Name = c.Name,
                    Weight = c.Weight,
                    MaxScore = c.MaxScore,
                    MyScore = mineRow?.Score,
                    MyNote = mineRow?.Note
                };
            }).ToList()
        };
    }

    /// <summary>Độ lệch chuẩn tổng thể (population). 0 nếu &lt; 2 giá trị.</summary>
    private static double StdDevPopulation(IReadOnlyList<double> values)
    {
        if (values.Count < 2) return 0.0;
        var mean = values.Average();
        var variance = values.Sum(v => (v - mean) * (v - mean)) / values.Count;
        return Math.Sqrt(variance);
    }

    private static decimal Round(double v) => Math.Round((decimal)v, 2);

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };

    private static BaseException Forbidden(string msg) => new(msg)
    {
        ErrorCode = "FORBIDDEN", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Forbidden
    };
}
