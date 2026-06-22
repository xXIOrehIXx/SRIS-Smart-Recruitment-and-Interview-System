using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Candidate.Quiz;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Serilog;
// "Application" trùng tên namespace GP35.SRIS.Application -> alias để dùng entity.
using ApplicationEntity = GP35.SRIS.Domain.Entities.Application;

namespace GP35.SRIS.Application.Services.CandidatePortal;

/// <summary>
/// Điều phối ứng viên làm quiz (5.6). Server là nguồn chân lý: timer tính từ started_at,
/// chấm MCQ bằng correct_option (không gửi xuống client), ngưỡng anti-cheat ép ở server.
/// </summary>
public class CandidateQuizService : BaseService<CandidateQuizService>, ICandidateQuizService
{
    private const int DefaultTabSwitchLimit = 3; // ngưỡng chuyển tab (công khai cho ứng viên — 5.5)
    private const string Purpose = "QUIZ";

    private readonly IMagicLinkService _magicLink;
    private readonly IApplicationRepo _appRepo;
    private readonly IQuizRepo _quizRepo;
    private readonly IQuizAttemptRepo _attemptRepo;
    private readonly ILogger _logger;

    public CandidateQuizService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _quizRepo = serviceProvider.GetRequiredService<IQuizRepo>();
        _attemptRepo = serviceProvider.GetRequiredService<IQuizAttemptRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CandidateQuizService>();
    }

    public async Task<CandidateQuizDto> StartAsync(string rawToken, string? ipAddress)
    {
        var ctx = await LoadContextAsync(rawToken);

        var attempt = ctx.Attempt;
        if (attempt is null)
        {
            // Lượt đầu — tạo mới, server đóng dấu started_at để khởi động timer.
            var newAttempt = new QuizAttempt
            {
                ApplicationId = ctx.App.ApplicationId,
                QuizId = ctx.Quiz.Quiz.QuizId,
                Status = "IN_PROGRESS",
                StartedAt = DateTime.UtcNow,
                IpAddress = ipAddress
            };
            var attemptId = await _attemptRepo.InsertAttemptAsync(ctx.CompanyId, newAttempt);
            newAttempt.AttemptId = attemptId;
            attempt = newAttempt;
            _logger.Information("Quiz: bắt đầu lượt làm attempt={AttemptId} app={AppId}.",
                attemptId, ctx.App.ApplicationId);
        }
        else if (IsFinished(attempt))
        {
            throw Conflict("Bạn đã nộp bài thi này. Không thể làm lại.");
        }
        else if (RemainingSeconds(ctx.Quiz.Quiz, attempt) is <= 0)
        {
            // Mở lại nhưng đã quá giờ -> tự nộp phần đã làm.
            await GradeAndFinalizeAsync(ctx, attempt, "AUTO_SUBMITTED");
            throw Gone("Đã hết thời gian làm bài — hệ thống đã tự nộp phần bạn đã làm.");
        }

        return BuildQuizView(ctx, attempt);
    }

    public async Task SaveAnswerAsync(string rawToken, SaveAnswerDto dto)
    {
        var ctx = await LoadActiveOrAutoSubmitAsync(rawToken);

        if (ctx.Quiz.Questions.All(q => q.QuestionId != dto.QuestionId))
            throw Bad("Câu hỏi không thuộc bài thi này.");

        await _attemptRepo.UpsertAnswerAsync(
            ctx.CompanyId, ctx.Attempt!.AttemptId, dto.QuestionId, NormalizeOption(dto.SelectedOption));
    }

    public async Task<AntiCheatAckDto> RecordEventAsync(string rawToken, AntiCheatEventDto dto)
    {
        var eventType = NormalizeEventType(dto.EventType);
        var ctx = await LoadActiveOrAutoSubmitAsync(rawToken);
        var attempt = ctx.Attempt!;

        var weight = RiskWeight(eventType);
        await _attemptRepo.InsertEventAsync(ctx.CompanyId, new AntiCheatEvent
        {
            AttemptId = attempt.AttemptId,
            EventType = eventType,
            Severity = Severity(weight),
            Detail = dto.Detail,
            OccurredAt = DateTime.UtcNow
        }, weight);

        // Vượt ngưỡng chuyển tab -> khóa & tự nộp (công khai ngưỡng — 5.5).
        if (eventType == "TAB_SWITCH")
        {
            var count = await _attemptRepo.CountEventsAsync(ctx.CompanyId, attempt.AttemptId, "TAB_SWITCH");
            if (count > DefaultTabSwitchLimit)
            {
                await GradeAndFinalizeAsync(ctx, attempt, "AUTO_SUBMITTED");
                _logger.Warning("Quiz: vượt ngưỡng tab-switch ({Count}) -> tự nộp attempt={AttemptId}.",
                    count, attempt.AttemptId);
                return new AntiCheatAckDto { Locked = true, RiskScore = attempt.RiskScore + weight };
            }
        }

        return new AntiCheatAckDto { Locked = false, RiskScore = attempt.RiskScore + weight };
    }

    public async Task<QuizResultDto> SubmitAsync(string rawToken)
    {
        var ctx = await LoadContextAsync(rawToken);
        var attempt = ctx.Attempt
            ?? throw Conflict("Bạn chưa bắt đầu làm bài.");

        if (IsFinished(attempt))
            throw Conflict("Bài thi đã được nộp trước đó.");

        var result = await GradeAndFinalizeAsync(ctx, attempt, "SUBMITTED");
        _logger.Information("Quiz: ứng viên nộp bài attempt={AttemptId} điểm={Score}.",
            attempt.AttemptId, result.Score);
        return result;
    }

    // ============================================================
    //  Helpers
    // ============================================================

    private sealed record QuizContext(
        long CompanyId, MagicLinkValidation Validation, ApplicationEntity App,
        QuizWithQuestions Quiz, QuizAttempt? Attempt);

    /// <summary>Xác thực token + nạp hồ sơ/quiz/lượt làm hiện tại.</summary>
    private async Task<QuizContext> LoadContextAsync(string rawToken)
    {
        var v = await _magicLink.ValidateAsync(rawToken, Purpose);

        var app = await _appRepo.GetByIdAsync(v.CompanyId, v.ApplicationId)
            ?? throw NotFound("Không tìm thấy hồ sơ ứng tuyển.");

        if (!string.Equals(app.CurrentState, "QUIZ", StringComparison.OrdinalIgnoreCase))
            throw Conflict("Hồ sơ của bạn hiện không ở bước làm bài thi.");

        var quizId = await _attemptRepo.GetReadyQuizIdByJobAsync(v.CompanyId, app.JobId)
            ?? throw Conflict("Bài thi chưa sẵn sàng. Vui lòng quay lại sau.");

        var quiz = await _quizRepo.GetByIdAsync(v.CompanyId, quizId)
            ?? throw Conflict("Bài thi chưa sẵn sàng.");

        var attempt = await _attemptRepo.GetLatestAttemptAsync(v.CompanyId, app.ApplicationId, quizId);
        return new QuizContext(v.CompanyId, v, app, quiz, attempt);
    }

    /// <summary>Như LoadContext nhưng đòi lượt làm ĐANG mở; hết giờ thì tự nộp rồi báo Gone.</summary>
    private async Task<QuizContext> LoadActiveOrAutoSubmitAsync(string rawToken)
    {
        var ctx = await LoadContextAsync(rawToken);
        var attempt = ctx.Attempt
            ?? throw Conflict("Bạn chưa bắt đầu làm bài.");

        if (IsFinished(attempt))
            throw Conflict("Bài thi đã được nộp.");

        if (RemainingSeconds(ctx.Quiz.Quiz, attempt) is <= 0)
        {
            await GradeAndFinalizeAsync(ctx, attempt, "AUTO_SUBMITTED");
            throw Gone("Đã hết thời gian làm bài — hệ thống đã tự nộp.");
        }

        return ctx;
    }

    /// <summary>Chấm MCQ + chốt lượt + đốt token. Trả kết quả.</summary>
    private async Task<QuizResultDto> GradeAndFinalizeAsync(QuizContext ctx, QuizAttempt attempt, string status)
    {
        var answers = await _attemptRepo.GetAnswersAsync(ctx.CompanyId, attempt.AttemptId);
        var selectedByQuestion = answers
            .Where(a => a.SelectedOption is not null)
            .ToDictionary(a => a.QuestionId, a => a.SelectedOption!);

        var correctness = new Dictionary<long, bool>();
        var totalPoints = 0;
        var earnedPoints = 0;
        var correctCount = 0;

        foreach (var q in ctx.Quiz.Questions)
        {
            var points = q.Points > 0 ? q.Points : 1;
            totalPoints += points;

            if (selectedByQuestion.TryGetValue(q.QuestionId, out var selected))
            {
                var isCorrect = string.Equals(selected, q.CorrectOption, StringComparison.OrdinalIgnoreCase);
                correctness[q.QuestionId] = isCorrect;
                if (isCorrect)
                {
                    earnedPoints += points;
                    correctCount++;
                }
            }
        }

        var score = totalPoints == 0 ? 0m : Math.Round(earnedPoints * 100m / totalPoints, 2);
        var elapsed = ElapsedSeconds(attempt);

        await _attemptRepo.FinalizeAttemptAsync(
            ctx.CompanyId, attempt.AttemptId, score, elapsed, status, correctness);

        // One-time: đốt token khi đã CHỐT (5.13).
        await _magicLink.MarkUsedAsync(ctx.CompanyId, ctx.Validation.TokenId);

        return new QuizResultDto
        {
            AttemptId = attempt.AttemptId,
            Score = score,
            CorrectCount = correctCount,
            TotalQuestions = ctx.Quiz.Questions.Count,
            Status = status
        };
    }

    private static CandidateQuizDto BuildQuizView(QuizContext ctx, QuizAttempt attempt)
    {
        var remaining = RemainingSeconds(ctx.Quiz.Quiz, attempt);
        return new CandidateQuizDto
        {
            AttemptId = attempt.AttemptId,
            QuizId = ctx.Quiz.Quiz.QuizId,
            DurationMin = ctx.Quiz.Quiz.DurationMin,
            RemainingSeconds = remaining,
            TabSwitchLimit = DefaultTabSwitchLimit,
            Questions = ctx.Quiz.Questions.Select(q => new CandidateQuestionDto
            {
                QuestionId = q.QuestionId,
                Content = q.Content,
                Options = JsonConvert.DeserializeObject<List<string>>(q.OptionsJson) ?? new List<string>()
            }).ToList()
        };
    }

    private static bool IsFinished(QuizAttempt a) =>
        a.Status is "SUBMITTED" or "AUTO_SUBMITTED" || a.SubmittedAt is not null;

    private static int ElapsedSeconds(QuizAttempt a) =>
        a.StartedAt is null ? 0 : (int)Math.Max(0, (DateTime.UtcNow - a.StartedAt.Value).TotalSeconds);

    /// <summary>Giây còn lại của lượt. Null nếu quiz không giới hạn thời gian.</summary>
    private static int? RemainingSeconds(Quiz quiz, QuizAttempt attempt)
    {
        if (quiz.DurationMin is not int min || attempt.StartedAt is null) return null;
        return min * 60 - ElapsedSeconds(attempt);
    }

    private static string? NormalizeOption(string? option) =>
        string.IsNullOrWhiteSpace(option) ? null : option.Trim().ToUpperInvariant();

    private static string NormalizeEventType(string? eventType)
    {
        var t = (eventType ?? "").Trim().ToUpperInvariant();
        return RiskWeights.ContainsKey(t) ? t : throw Bad($"Loại sự kiện không hợp lệ: '{eventType}'.");
    }

    private static readonly Dictionary<string, int> RiskWeights = new(StringComparer.OrdinalIgnoreCase)
    {
        ["TAB_SWITCH"] = 10,
        ["BLUR"] = 5,
        ["VISIBILITY_HIDDEN"] = 5,
        ["PASTE"] = 15,
        ["COPY"] = 5,
        ["DEVTOOLS"] = 20,
        ["MULTI_MONITOR"] = 10,
        ["FULLSCREEN_EXIT"] = 5,
        ["DISCONNECT"] = 5
    };

    private static int RiskWeight(string eventType) => RiskWeights.GetValueOrDefault(eventType, 5);

    private static string Severity(int weight) => weight switch
    {
        >= 15 => "HIGH",
        >= 10 => "MEDIUM",
        _ => "LOW"
    };

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

    private static BaseException Gone(string msg) => new(msg)
    {
        ErrorCode = "QUIZ_TIME_UP", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Gone
    };
}
