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
    private readonly IJobRepo _jobRepo;
    private readonly ICandidateRepo _candidateRepo;
    private readonly IEvaluationCriteriaRepo _criteriaRepo;
    private readonly IInterviewScoreRepo _scoreRepo;
    private readonly ILogger _logger;

    public InterviewScoringService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _schedulingRepo = serviceProvider.GetRequiredService<ISchedulingRepo>();
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _candidateRepo = serviceProvider.GetRequiredService<ICandidateRepo>();
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
            Status = s.Status,
            MySheetStatus = string.IsNullOrWhiteSpace(s.MySheetStatus) ? "NOT_STARTED" : s.MySheetStatus,
            StartTime = s.StartTime,
            CandidateName = s.CandidateName,
            CandidateEmail = s.CandidateEmail,
            JobTitle = s.JobTitle,
            ApplicationState = s.ApplicationState,
            IsLocked = ApplicationStateMachine.IsScoringLocked(s.ApplicationState)
        }).ToList();
    }

    public async Task<ScoringSheetDto> GetSheetAsync(long companyId, long interviewerId, long scheduleId)
    {
        await EnsureAssignedAsync(companyId, scheduleId, interviewerId);
        return await BuildSheetFullAsync(companyId, scheduleId, interviewerId);
    }

    public async Task<ScoringSheetDto> SaveDraftAsync(
        long companyId, long interviewerId, long scheduleId, SaveScoreDraftDto dto)
    {
        await EnsureAssignedAsync(companyId, scheduleId, interviewerId);
        await EnsureNotLockedAsync(companyId, scheduleId);
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

        // Kết luận đi cùng vòng đời với điểm: nháp lưu được dù chưa chọn đề xuất.
        var recommendation = Trim(dto.Recommendation)?.ToUpperInvariant();
        if (recommendation is not null && !InterviewRecommendation.IsValid(recommendation))
            throw Bad("Đề xuất không hợp lệ (STRONG_HIRE | HIRE | CONSIDER | NO_HIRE).");

        await _scoreRepo.UpsertFeedbackAsync(
            companyId, scheduleId, interviewerId, recommendation, Trim(dto.Summary));

        return await BuildSheetFullAsync(companyId, scheduleId, interviewerId);
    }

    public async Task<ScoringSheetDto> SubmitAsync(long companyId, long interviewerId, long scheduleId)
    {
        await EnsureAssignedAsync(companyId, scheduleId, interviewerId);
        await EnsureNotLockedAsync(companyId, scheduleId);
        var criteria = await GetActiveCriteriaAsync(companyId, scheduleId);
        if (criteria.Count == 0)
            throw Conflict("Job chưa có tiêu chí chấm nào — Human Resource cần cấu hình trước.");

        var mine = await _scoreRepo.GetByScheduleAndInterviewerAsync(companyId, scheduleId, interviewerId);
        var scored = mine.Where(s => s.Score is not null).Select(s => s.CriteriaId).ToHashSet();

        var missing = criteria.Where(c => !scored.Contains(c.CriteriaId)).ToList();
        if (missing.Count > 0)
            throw Bad($"Hãy chấm đủ điểm trước khi nộp. Còn thiếu: {string.Join(", ", missing.Select(c => c.Name))}.");

        // Nộp phiếu = đưa ra kết luận. Người quyết tuyển đọc kết luận chứ không đọc điểm,
        // nên phiếu không có đề xuất thì màn quyết định trống — chặn ngay ở đây.
        var feedback = await _scoreRepo.GetFeedbackAsync(companyId, scheduleId, interviewerId);
        if (!InterviewRecommendation.IsValid(feedback?.Recommendation))
            throw Bad("Hãy chọn đề xuất (nên tuyển / không nên / chưa chắc) trước khi nộp phiếu.");

        await _scoreRepo.SubmitAsync(companyId, scheduleId, interviewerId);
        await _scoreRepo.SubmitFeedbackAsync(companyId, scheduleId, interviewerId);
        _logger.Information("Scoring: interviewer {InterviewerId} nộp phiếu buổi {ScheduleId} — đề xuất {Rec} (mở blind).",
            interviewerId, scheduleId, feedback!.Recommendation);

        return await BuildSheetFullAsync(companyId, scheduleId, interviewerId);
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

        // Điểm tổng từng interviewer, quy về PHẦN TRĂM có trọng số (chỉ tính tiêu chí họ đã chấm).
        // Mẫu số là điểm TỐI ĐA có trọng số chứ không phải tổng trọng số: mỗi tiêu chí có maxScore
        // riêng, cộng điểm thô lại thì 5/5 (hoàn hảo) và 5/10 (một nửa) đóng góp như nhau.
        // Cùng công thức với phiếu chấm bên FE -> interviewer và DM nhìn thấy một con số.
        var critById = criteria.ToDictionary(c => c.CriteriaId);
        var totals = new List<InterviewerTotalDto>();
        foreach (var id in interviewerIds)
        {
            decimal earned = 0, possible = 0;
            foreach (var r in submitted.Where(s => s.InterviewerId == id && s.Score is not null))
            {
                if (!critById.TryGetValue(r.CriteriaId, out var c) || c.MaxScore <= 0) continue;
                earned += r.Score!.Value * c.Weight;
                possible += c.MaxScore * c.Weight;
            }
            totals.Add(new InterviewerTotalDto
            {
                InterviewerId = id,
                WeightedPercent = possible == 0 ? 0 : Math.Round(earned / possible * 100, 1)
            });
        }

        var panelAvg = totals.Count == 0 ? 0m : Math.Round(totals.Average(t => t.WeightedPercent), 1);

        // Tên người chấm (blind đã mở vì chỉ lấy phiếu SUBMITTED) — DM cần biết ai cho điểm nào.
        var names = await GetInterviewerNamesAsync(companyId, interviewerIds);
        foreach (var c in critDtos)
            foreach (var s in c.Scores)
                s.InterviewerName = names.GetValueOrDefault(s.InterviewerId);
        foreach (var t in totals)
            t.InterviewerName = names.GetValueOrDefault(t.InterviewerId);

        return new ScheduleAggregateDto
        {
            ScheduleId = scheduleId,
            SubmittedInterviewers = interviewerIds.Count,
            Criteria = critDtos,
            InterviewerTotals = totals,
            PanelWeightedPercent = panelAvg
        };
    }

    public async Task<IReadOnlyList<ScheduleAggregateDto>> GetAggregatesByApplicationAsync(
        long companyId, long applicationId)
    {
        _ = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        var schedules = await _schedulingRepo.GetSchedulesByApplicationAsync(companyId, applicationId);

        var result = new List<ScheduleAggregateDto>(schedules.Count);
        foreach (var s in schedules)
        {
            var agg = await GetAggregateAsync(companyId, s.ScheduleId);
            agg.RoundNumber = s.RoundNumber;
            agg.ScheduleStatus = s.Status;
            agg.ScheduledAt = s.ConfirmedSlotId is long slotId
                ? (await _schedulingRepo.GetSlotAsync(companyId, slotId))?.StartTime
                : null;
            result.Add(agg);
        }

        return result;
    }

    public async Task<DecisionBriefDto> GetDecisionBriefAsync(long companyId, long applicationId)
    {
        var detail = await _appRepo.GetDetailAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        var job = await _jobRepo.GetByIdAsync(companyId, detail.JobId);
        var criteriaNames = (await _criteriaRepo.GetByJobAsync(companyId, detail.JobId, activeOnly: false))
            .ToDictionary(c => c.CriteriaId, c => c.Name);

        var brief = new DecisionBriefDto
        {
            ApplicationId = detail.ApplicationId,
            CurrentState = detail.CurrentState,
            AppliedAt = detail.AppliedAt,
            CandidateId = detail.CandidateId,
            CandidateName = detail.CandidateName,
            CandidateEmail = detail.CandidateEmail,
            CandidatePhone = detail.CandidatePhone,
            JobId = detail.JobId,
            JobTitle = detail.JobTitle,
            Department = job?.Department,
            CvId = detail.CvId,
            CvFileName = detail.CvFileName
        };

        var schedules = await _schedulingRepo.GetSchedulesByApplicationAsync(companyId, applicationId);
        foreach (var s in schedules)
        {
            // BLIND REVIEW: cả hai nguồn dưới đây đều đã lọc "đã nộp" ở repo — nháp của người
            // khác không bao giờ chạm tới màn quyết định.
            var scores = await _scoreRepo.GetSubmittedByScheduleAsync(companyId, s.ScheduleId);
            var feedbacks = await _scoreRepo.GetSubmittedFeedbackByScheduleAsync(companyId, s.ScheduleId);

            // Ai đã nộp = có phiếu điểm SUBMITTED. Kết luận có thể thiếu với phiếu nộp từ
            // trước khi có V031 -> vẫn hiện người đó, chỉ để trống phần đề xuất.
            var interviewerIds = scores.Select(x => x.InterviewerId)
                .Union(feedbacks.Select(f => f.InterviewerId))
                .Distinct()
                .ToList();

            var names = await GetInterviewerNamesAsync(companyId, interviewerIds);

            var verdicts = interviewerIds.Select(id =>
            {
                var fb = feedbacks.FirstOrDefault(f => f.InterviewerId == id);
                return new InterviewerVerdictDto
                {
                    InterviewerId = id,
                    InterviewerName = names.GetValueOrDefault(id),
                    Recommendation = fb?.Recommendation,
                    Summary = fb?.Summary,
                    SubmittedAt = fb?.SubmittedAt,
                    Notes = scores
                        .Where(x => x.InterviewerId == id && !string.IsNullOrWhiteSpace(x.Note))
                        .Select(x => new CriterionNoteDto
                        {
                            CriteriaName = criteriaNames.GetValueOrDefault(x.CriteriaId, "Tiêu chí"),
                            Note = x.Note!.Trim()
                        })
                        .ToList()
                };
            })
            // Người nói KHÔNG nên tuyển đưa lên trước: ý kiến phản đối là thứ người quyết
            // dễ bỏ sót nhất khi lướt nhanh.
            .OrderBy(v => v.Recommendation == InterviewRecommendation.NoHire ? 0
                        : v.Recommendation == InterviewRecommendation.Consider ? 1 : 2)
            .ToList();

            brief.Rounds.Add(new DecisionRoundDto
            {
                ScheduleId = s.ScheduleId,
                RoundNumber = s.RoundNumber,
                ScheduleStatus = s.Status,
                ScheduledAt = s.ConfirmedSlotId is long slotId
                    ? (await _schedulingRepo.GetSlotAsync(companyId, slotId))?.StartTime
                    : null,
                SubmittedInterviewers = scores.Select(x => x.InterviewerId).Distinct().Count(),
                Verdicts = verdicts
            });
        }

        var all = brief.Rounds.SelectMany(r => r.Verdicts).ToList();
        brief.TotalSubmitted = all.Count;
        brief.HireCount = all.Count(v => InterviewRecommendation.IsPositive(v.Recommendation));
        brief.ConsiderCount = all.Count(v => v.Recommendation == InterviewRecommendation.Consider);
        brief.NoHireCount = all.Count(v => v.Recommendation == InterviewRecommendation.NoHire);

        var notes = await _serviceProvider.GetRequiredService<IInternalNoteRepo>()
            .GetByApplicationAsync(companyId, applicationId);
        brief.InternalNotes = notes.Select(n => new DecisionNoteDto
        {
            AuthorName = n.AuthorEmail,
            Content = n.Content,
            CreatedAt = n.CreatedAt
        }).ToList();

        return brief;
    }

    // ============================================================

    /// <summary>user_id -> tên hiển thị (full_name, rơi về email). Rỗng khi không có ai chấm.</summary>
    private async Task<Dictionary<long, string>> GetInterviewerNamesAsync(
        long companyId, IReadOnlyList<long> interviewerIds)
    {
        if (interviewerIds.Count == 0) return new Dictionary<long, string>();

        var users = await _serviceProvider.GetRequiredService<IUserRepo>()
            .GetNamesByIdsAsync(companyId, interviewerIds);

        return users.ToDictionary(
            u => u.UserId,
            u => string.IsNullOrWhiteSpace(u.FullName) ? u.Email : u.FullName!);
    }

    private async Task EnsureAssignedAsync(long companyId, long scheduleId, long interviewerId)
    {
        var assigned = await _schedulingRepo.IsInterviewerOnScheduleAsync(companyId, scheduleId, interviewerId);
        if (!assigned)
            throw Forbidden("Bạn không được giao chấm buổi phỏng vấn này.");
    }

    /// <summary>Hồ sơ của buổi phỏng vấn (đã lọc tenant) — nguồn của jobId + trạng thái khóa phiếu.</summary>
    private async Task<(long JobId, string CurrentState)> GetApplicationOfScheduleAsync(
        long companyId, long scheduleId)
    {
        var schedule = await _schedulingRepo.GetScheduleByIdAsync(companyId, scheduleId)
            ?? throw NotFound($"Không tìm thấy buổi phỏng vấn (schedule_id={scheduleId}).");
        var app = await _appRepo.GetByIdAsync(companyId, schedule.ApplicationId)
            ?? throw NotFound("Không tìm thấy hồ sơ của buổi phỏng vấn.");
        return (app.JobId, app.CurrentState);
    }

    /// <summary>
    /// Phiếu chỉ khóa khi hồ sơ đã sang bước quyết định (OFFER/HIRED/REJECTED).
    /// Nộp phiếu KHÔNG khóa — interviewer còn sửa điểm / bổ sung note tới khi người quyết chốt.
    /// </summary>
    private async Task EnsureNotLockedAsync(long companyId, long scheduleId)
    {
        var (_, state) = await GetApplicationOfScheduleAsync(companyId, scheduleId);
        if (ApplicationStateMachine.IsScoringLocked(state))
            throw Conflict(ApplicationStateMachine.ScoringLockReason(state)!);
    }

    private async Task<IReadOnlyList<EvaluationCriteria>> GetActiveCriteriaAsync(long companyId, long scheduleId)
    {
        var (jobId, _) = await GetApplicationOfScheduleAsync(companyId, scheduleId);
        return await _criteriaRepo.GetByJobAsync(companyId, jobId, activeOnly: true);
    }

    /// <summary>
    /// Build đầy đủ: tiêu chí ACTIVE + điểm/note của interviewer + thông tin buổi + ứng viên + panel size.
    /// Dùng cho cả Get / Save / Submit để FE có đủ context bind header (vòng, thời gian, số người panel).
    /// </summary>
    private async Task<ScoringSheetDto> BuildSheetFullAsync(
        long companyId, long scheduleId, long interviewerId)
    {
        var schedule = await _schedulingRepo.GetScheduleByIdAsync(companyId, scheduleId)
            ?? throw NotFound($"Không tìm thấy buổi phỏng vấn (schedule_id={scheduleId}).");
        var app = await _appRepo.GetByIdAsync(companyId, schedule.ApplicationId)
            ?? throw NotFound("Không tìm thấy hồ sơ của buổi phỏng vấn.");

        var criteria = await _criteriaRepo.GetByJobAsync(companyId, app.JobId, activeOnly: true);
        var mine = await _scoreRepo.GetByScheduleAndInterviewerAsync(companyId, scheduleId, interviewerId);
        var panelSize = await _schedulingRepo.GetPanelSizeAsync(companyId, scheduleId);

        var coreDto = BuildSheet(scheduleId, criteria, mine);

        var myFeedback = await _scoreRepo.GetFeedbackAsync(companyId, scheduleId, interviewerId);
        coreDto.MyRecommendation = myFeedback?.Recommendation;
        coreDto.MySummary = myFeedback?.Summary;

        // Lấy thông tin Job + Candidate — đã có scope, query trực tiếp qua repo đã đăng ký.
        var job = await _jobRepo.GetByIdAsync(companyId, app.JobId);
        var candidate = await _candidateRepo.GetByIdAsync(companyId, app.CandidateId);

        // Lấy startTime từ slot đã chốt (cùng nguồn với list schedules).
        var slotStart = await _schedulingRepo.GetConfirmedSlotStartAsync(companyId, scheduleId);

        coreDto.Schedule = new ScoringScheduleInfoDto
        {
            ScheduleId = schedule.ScheduleId,
            ApplicationId = schedule.ApplicationId,
            RoundNumber = schedule.RoundNumber,
            Status = schedule.Status,
            StartTime = slotStart,
            JobTitle = job?.Title ?? string.Empty,
            PanelSize = panelSize,
        };
        coreDto.Candidate = candidate is null ? null : new ScoringCandidateInfoDto
        {
            CandidateId = candidate.CandidateId,
            FullName = candidate.FullName ?? string.Empty,
            Email = candidate.Email ?? string.Empty,
        };

        // Khóa theo TRẠNG THÁI HỒ SƠ, không theo trạng thái phiếu: đã nộp vẫn sửa được.
        coreDto.ApplicationState = app.CurrentState;
        coreDto.IsLocked = ApplicationStateMachine.IsScoringLocked(app.CurrentState);
        coreDto.LockReason = ApplicationStateMachine.ScoringLockReason(app.CurrentState);

        return coreDto;
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

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

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
