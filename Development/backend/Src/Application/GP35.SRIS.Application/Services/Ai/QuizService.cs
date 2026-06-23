using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Ai.Quiz;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Ai;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Serilog;

namespace GP35.SRIS.Application.Services.Ai;

/// <summary>
/// Điều phối quiz AI (5.6). Python AI gen quiz thô từ JD; .NET lo ghi DB (DRAFT),
/// các nút hành động AI và bước Recruiter duyệt (DRAFT -> READY). Quiz MCQ-only.
/// </summary>
public class QuizService : BaseService<QuizService>, IQuizService
{
    private const int MaxQuestionsPerCall = 50;

    private readonly IJobRepo _jobRepo;
    private readonly IQuizRepo _quizRepo;
    private readonly IQuestionBankRepo _bankRepo;
    private readonly IQuizGenClient _quizGenClient;
    private readonly IContextData _contextData;
    private readonly ILogger _logger;

    public QuizService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _quizRepo = serviceProvider.GetRequiredService<IQuizRepo>();
        _bankRepo = serviceProvider.GetRequiredService<IQuestionBankRepo>();
        _quizGenClient = serviceProvider.GetRequiredService<IQuizGenClient>();
        _contextData = serviceProvider.GetRequiredService<IContextData>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<QuizService>();
    }

    public async Task<QuizDto> GenerateFromJdAsync(long companyId, long jobId, int numQuestions = 10)
    {
        var jdText = await GetJdTextOrThrowAsync(companyId, jobId);
        var generated = await GenerateOrThrowAsync(jdText, ClampCount(numQuestions));

        var quiz = new Quiz
        {
            JobId = jobId,
            Type = "MCQ",
            Status = "DRAFT",
            GeneratedByAi = true
        };
        var questions = generated.Select(ToEntity).ToList();

        var quizId = await _quizRepo.InsertQuizWithQuestionsAsync(companyId, quiz, questions);
        _logger.Information("QuizService: gen quiz DRAFT quizId={QuizId} jobId={JobId} ({Count} câu).",
            quizId, jobId, questions.Count);

        return await GetByIdOrThrowAsync(companyId, quizId);
    }

    public async Task<QuizDto> AddQuestionsAsync(long companyId, long quizId, int count = 1)
    {
        var quiz = await GetDraftQuizOrThrowAsync(companyId, quizId);
        var jdText = await GetJdTextOrThrowAsync(companyId, quiz.Quiz.JobId);

        var avoid = quiz.Questions.Select(q => q.Content).ToList();
        var generated = await GenerateOrThrowAsync(jdText, ClampCount(count), avoid: avoid);

        await _quizRepo.AddQuestionsAsync(companyId, quizId, generated.Select(ToEntity).ToList());
        return await GetByIdOrThrowAsync(companyId, quizId);
    }

    public async Task<QuizDto> AddByTopicAsync(long companyId, long quizId, string topic)
    {
        if (string.IsNullOrWhiteSpace(topic))
            throw Bad("Chủ đề không được để trống.");

        var quiz = await GetDraftQuizOrThrowAsync(companyId, quizId);
        var jdText = await GetJdTextOrThrowAsync(companyId, quiz.Quiz.JobId);

        var avoid = quiz.Questions.Select(q => q.Content).ToList();
        var generated = await GenerateOrThrowAsync(jdText, 1, topic: topic, avoid: avoid);

        await _quizRepo.AddQuestionsAsync(companyId, quizId, generated.Select(ToEntity).ToList());
        return await GetByIdOrThrowAsync(companyId, quizId);
    }

    public async Task<QuizDto> RegenerateQuestionAsync(long companyId, long quizId, long questionId)
    {
        var quiz = await GetDraftQuizOrThrowAsync(companyId, quizId);

        var target = quiz.Questions.FirstOrDefault(q => q.QuestionId == questionId)
            ?? throw NotFound($"Không tìm thấy câu hỏi (question_id={questionId}) trong quiz này.");

        // Tránh trùng các câu CÒN LẠI (không tính chính câu đang thay).
        var avoid = quiz.Questions.Where(q => q.QuestionId != questionId).Select(q => q.Content).ToList();
        var generated = await GenerateOrThrowAsync(quiz.Quiz.JobId, companyId, avoid);

        var newQ = ToEntity(generated[0]);
        newQ.QuestionId = target.QuestionId; // thay tại chỗ, giữ vị trí (order theo question_id)
        newQ.Points = target.Points;
        await _quizRepo.UpdateQuestionAsync(companyId, newQ);

        return await GetByIdOrThrowAsync(companyId, quizId);
    }

    public async Task<QuizDto> UpdateQuestionAsync(
        long companyId, long quizId, long questionId, UpdateQuizQuestionDto dto)
    {
        var quiz = await GetDraftQuizOrThrowAsync(companyId, quizId);

        if (quiz.Questions.All(q => q.QuestionId != questionId))
            throw NotFound($"Không tìm thấy câu hỏi (question_id={questionId}) trong quiz này.");

        if (dto.Options is null || dto.Options.Count < 2)
            throw Bad("Câu hỏi phải có ít nhất 2 phương án.");
        if (dto.CorrectIndex < 0 || dto.CorrectIndex >= dto.Options.Count)
            throw Bad("correctIndex nằm ngoài khoảng phương án.");

        var entity = new QuizQuestion
        {
            QuestionId = questionId,
            Content = dto.Content,
            OptionsJson = JsonConvert.SerializeObject(dto.Options),
            CorrectOption = IndexToLabel(dto.CorrectIndex),
            Points = dto.Points > 0 ? dto.Points : 1
        };
        await _quizRepo.UpdateQuestionAsync(companyId, entity);

        return await GetByIdOrThrowAsync(companyId, quizId);
    }

    public async Task<QuizDto> ApproveAsync(long companyId, long quizId)
    {
        var quiz = await _quizRepo.GetByIdAsync(companyId, quizId)
            ?? throw NotFound($"Không tìm thấy quiz (quiz_id={quizId}).");

        if (!string.Equals(quiz.Quiz.Status, "DRAFT", StringComparison.OrdinalIgnoreCase))
            throw Conflict($"Chỉ duyệt được quiz đang ở DRAFT (hiện: {quiz.Quiz.Status}).");
        if (quiz.Questions.Count == 0)
            throw Bad("Quiz chưa có câu hỏi nào — không thể duyệt READY.");

        await _quizRepo.UpdateStatusAsync(companyId, quizId, "READY");
        _logger.Information("QuizService: duyệt quiz quizId={QuizId} -> READY.", quizId);

        // Bank tự bồi: ghim các câu đã duyệt vào ngân hàng để tái dùng sau (best-effort —
        // lỗi ghim KHÔNG được làm hỏng việc duyệt quiz).
        await HarvestToBankAsync(companyId, quiz);

        return await GetByIdOrThrowAsync(companyId, quizId);
    }

    public async Task<QuizDto> AddFromBankAsync(long companyId, long quizId, AddFromBankDto dto)
    {
        var quiz = await GetDraftQuizOrThrowAsync(companyId, quizId);

        var count = dto.Count > 0 ? dto.Count : 5;
        var existing = quiz.Questions.Select(q => q.Content).ToList();

        var picked = await _bankRepo.PickAsync(companyId, dto.Topic, count, existing);
        if (picked.Count == 0)
            throw NotFound("Không tìm thấy câu phù hợp trong ngân hàng câu hỏi.");

        var toAdd = picked.Select(b => new QuizQuestion
        {
            Content = b.Content,
            OptionsJson = b.OptionsJson,
            CorrectOption = b.CorrectOption,
            Points = 1
        }).ToList();

        await _quizRepo.AddQuestionsAsync(companyId, quizId, toAdd);
        _logger.Information("QuizService: kéo {Count} câu từ bank vào quiz quizId={QuizId}.",
            toAdd.Count, quizId);

        return await GetByIdOrThrowAsync(companyId, quizId);
    }

    public async Task<QuizDto?> GetByIdAsync(long companyId, long quizId)
    {
        var quiz = await _quizRepo.GetByIdAsync(companyId, quizId);
        return quiz is null ? null : MapQuiz(quiz);
    }

    public async Task<QuizDto?> GetLatestByJobAsync(long companyId, long jobId)
    {
        var quiz = await _quizRepo.GetLatestByJobAsync(companyId, jobId);
        return quiz is null ? null : MapQuiz(quiz);
    }

    // ============================================================
    //  Helpers
    // ============================================================

    /// <summary>Ghim các câu của 1 quiz vào ngân hàng (best-effort, bỏ trùng theo nội dung).</summary>
    private async Task HarvestToBankAsync(long companyId, QuizWithQuestions quiz)
    {
        try
        {
            var candidates = quiz.Questions.Select(q => new QuestionBankItem
            {
                Content = q.Content,
                OptionsJson = q.OptionsJson,
                CorrectOption = q.CorrectOption,
                Topic = q.Topic,
                Difficulty = q.Difficulty,
                SourceQuestionId = q.QuestionId,
                SourceJobId = quiz.Quiz.JobId,
                ApprovedBy = _contextData.UserId,
                ApprovedAt = DateTime.UtcNow
            }).ToList();

            var added = await _bankRepo.HarvestAsync(companyId, candidates);
            _logger.Information("QuizService: ghim {Added}/{Total} câu vào bank từ quiz quizId={QuizId}.",
                added, candidates.Count, quiz.Quiz.QuizId);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "QuizService: ghim bank thất bại cho quiz quizId={QuizId} (bỏ qua).",
                quiz.Quiz.QuizId);
        }
    }

    /// <summary>Overload cho gen-lại: lấy JD theo jobId rồi gen đúng 1 câu (tránh trùng).</summary>
    private async Task<List<GeneratedQuizQuestion>> GenerateOrThrowAsync(
        long jobId, long companyId, List<string> avoid)
    {
        var jdText = await GetJdTextOrThrowAsync(companyId, jobId);
        return await GenerateOrThrowAsync(jdText, 1, avoid: avoid);
    }

    private async Task<List<GeneratedQuizQuestion>> GenerateOrThrowAsync(
        string jdText, int numQuestions, string? topic = null, IEnumerable<string>? avoid = null)
    {
        try
        {
            return await _quizGenClient.GenerateAsync(jdText, numQuestions, topic, avoid);
        }
        catch (QuizGenException ex)
        {
            // AI không sinh được -> 502 + message gợi ý fallback HR nhập tay (5.6).
            throw new BaseException(ex.Message)
            {
                ErrorCode = "QUIZ_GEN_FAILED",
                ErrorMessage = ex.Message,
                HttpStatus = (int)HttpStatusCode.BadGateway
            };
        }
    }

    private async Task<string> GetJdTextOrThrowAsync(long companyId, long jobId)
    {
        var jobInfo = await _jobRepo.GetEmbeddingInfoAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (jobId={jobId}) trong công ty này.");

        if (string.IsNullOrWhiteSpace(jobInfo.JdText))
            throw Bad("Job chưa có mô tả công việc (jd_text) nên không thể sinh quiz.");

        return jobInfo.JdText;
    }

    private async Task<QuizWithQuestions> GetDraftQuizOrThrowAsync(long companyId, long quizId)
    {
        var quiz = await _quizRepo.GetByIdAsync(companyId, quizId)
            ?? throw NotFound($"Không tìm thấy quiz (quiz_id={quizId}).");

        if (!string.Equals(quiz.Quiz.Status, "DRAFT", StringComparison.OrdinalIgnoreCase))
            throw Conflict($"Quiz đã READY — chỉ chỉnh sửa được khi còn DRAFT (hiện: {quiz.Quiz.Status}).");

        return quiz;
    }

    private async Task<QuizDto> GetByIdOrThrowAsync(long companyId, long quizId)
    {
        var quiz = await _quizRepo.GetByIdAsync(companyId, quizId)
            ?? throw NotFound($"Không tìm thấy quiz (quiz_id={quizId}).");
        return MapQuiz(quiz);
    }

    private static QuizQuestion ToEntity(GeneratedQuizQuestion g) => new()
    {
        Content = g.Question,
        OptionsJson = JsonConvert.SerializeObject(g.Options),
        CorrectOption = IndexToLabel(g.CorrectIndex),
        Points = 1
    };

    private static QuizDto MapQuiz(QuizWithQuestions qw) => new()
    {
        QuizId = qw.Quiz.QuizId,
        JobId = qw.Quiz.JobId,
        Type = qw.Quiz.Type,
        Status = qw.Quiz.Status,
        GeneratedByAi = qw.Quiz.GeneratedByAi,
        Questions = qw.Questions.Select(MapQuestion).ToList()
    };

    private static QuizQuestionDto MapQuestion(QuizQuestion q) => new()
    {
        QuestionId = q.QuestionId,
        Content = q.Content,
        Options = JsonConvert.DeserializeObject<List<string>>(q.OptionsJson) ?? new List<string>(),
        CorrectIndex = LabelToIndex(q.CorrectOption),
        Points = q.Points
    };

    private static int ClampCount(int n) => Math.Clamp(n, 1, MaxQuestionsPerCall);

    /// <summary>0 -> "A", 1 -> "B" ... (correct_option lưu nhãn chữ trong schema).</summary>
    private static string IndexToLabel(int index) => ((char)('A' + Math.Max(0, index))).ToString();

    /// <summary>"A" -> 0, "B" -> 1 ... Trả 0 nếu nhãn không hợp lệ.</summary>
    private static int LabelToIndex(string? label)
    {
        if (string.IsNullOrWhiteSpace(label)) return 0;
        var c = char.ToUpperInvariant(label.Trim()[0]);
        var idx = c - 'A';
        return idx >= 0 ? idx : 0;
    }

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND",
        ErrorMessage = msg,
        HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST",
        ErrorMessage = msg,
        HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT",
        ErrorMessage = msg,
        HttpStatus = (int)HttpStatusCode.Conflict
    };
}
