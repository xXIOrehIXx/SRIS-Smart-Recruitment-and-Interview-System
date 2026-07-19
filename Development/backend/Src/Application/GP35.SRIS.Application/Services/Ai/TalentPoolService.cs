using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Ai;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Ai;
using Microsoft.Extensions.DependencyInjection;
using GP35.SRIS.Lib.Services;
using Serilog;

namespace GP35.SRIS.Application.Services.Ai;

/// <summary>
/// Talent Pool (Việc 13). Đảo chiều truy vấn chấm CV: 1 JD -> quét kho CvDocument cũ (cùng company_id),
/// Top N gần nhất + lọc độ tươi (withinMonths). Tái dùng embedding + VECTOR_DISTANCE, không thêm hạ tầng.
/// </summary>
public class TalentPoolService : BaseService<TalentPoolService>, ITalentPoolService
{
    // Chuẩn "độ tươi" hồ sơ: mặc định 6 tháng (nóng); chặn trần 36 tháng (quá cũ = vô nghĩa + rủi ro pháp lý).
    private const int DefaultWithinMonths = 6;
    private const int MaxWithinMonths = 36;
    private const int DefaultTopN = 10;
    private const int MaxTopN = 50;

    private readonly IJobRepo _jobRepo;
    private readonly IEmbeddingClient _embeddingClient;
    private readonly ICvDocumentRepo _cvRepo;
    private readonly ICompanyRepo _companyRepo;
    private readonly IEmailService _email;
    private readonly ILogger _logger;

    public TalentPoolService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _embeddingClient = serviceProvider.GetRequiredService<IEmbeddingClient>();
        _cvRepo = serviceProvider.GetRequiredService<ICvDocumentRepo>();
        _companyRepo = serviceProvider.GetRequiredService<ICompanyRepo>();
        _email = serviceProvider.GetRequiredService<IEmailService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<TalentPoolService>();
    }

    public async Task<bool> InviteAsync(long companyId, long jobId, string candidateEmail, string candidateName)
    {
        if (string.IsNullOrWhiteSpace(candidateEmail))
            return false;

        var job = await _jobRepo.GetByIdAsync(companyId, jobId);
        if (job is null)
            return false;

        var company = await _companyRepo.GetByCompanyId(companyId);
        var baseUrl = (_defaultConfig.CandidatePortal?.BaseUrl ?? "http://localhost:3000").TrimEnd('/');
        var link = $"{baseUrl}/{company?.Slug}/recruitment";

        var body = $@"<p>Chào {System.Net.WebUtility.HtmlEncode(candidateName)},</p>
<p>Chúng tôi thấy hồ sơ bạn từng gửi rất phù hợp với vị trí <b>{System.Net.WebUtility.HtmlEncode(job.Title)}</b>
mà {System.Net.WebUtility.HtmlEncode(company?.Name ?? "chúng tôi")} đang tuyển.</p>
<p>Xem chi tiết và ứng tuyển tại: <a href=""{link}"">{link}</a></p>
<p>Trân trọng.</p>";

        try
        {
            await _email.SendEmailAsync($"Mời ứng tuyển vị trí {job.Title}", body, candidateEmail.Trim(), string.Empty);
            _logger.Information("TalentPool: đã gửi email mời {Email} ứng tuyển job {JobId}.", candidateEmail, jobId);
            return true;
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "TalentPool: gửi email mời thất bại ({Email}, job {JobId}).", candidateEmail, jobId);
            return false;
        }
    }

    public async Task<TalentPoolResultDto> SuggestForJobAsync(
        long companyId, long jobId, int withinMonths, int topN)
    {
        withinMonths = withinMonths <= 0 ? DefaultWithinMonths : Math.Min(withinMonths, MaxWithinMonths);
        topN = topN <= 0 ? DefaultTopN : Math.Min(topN, MaxTopN);

        // (1) Job tồn tại? + JD đã có embedding chưa.
        var jobInfo = await _jobRepo.GetEmbeddingInfoAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy Job (jobId={jobId}) trong công ty này.");

        // (2) Lazy embedding cho JD (chỉ chạy 1 lần/job) — y như luồng chấm CV.
        if (!jobInfo.HasEmbedding)
        {
            if (string.IsNullOrWhiteSpace(jobInfo.JdText))
                throw Bad("Job chưa có mô tả công việc (jd_text) nên chưa gợi ý được CV.");

            var jdVector = await _embeddingClient.EmbedAsync(jobInfo.JdText);
            await _jobRepo.UpdateEmbeddingAsync(companyId, jobId, jdVector);
        }

        // (3) Quét kho CV cũ (raw SQL VECTOR_DISTANCE, kèm company_id + lọc độ tươi + bỏ CV đã ứng job này).
        var rows = await _cvRepo.GetTalentPoolByJobAsync(companyId, jobId, withinMonths, topN);

        var now = DateTime.UtcNow;
        var suggestions = rows.Select(r =>
        {
            // distance nhỏ = giống nhiều = điểm cao (cùng công thức với chấm CV).
            var score = Math.Clamp((decimal)Math.Round((1.0 - r.Distance) * 100.0, 2), 0m, 100m);
            int? ageDays = r.UploadedAt is DateTime up ? Math.Max(0, (int)(now - up).TotalDays) : null;
            return new TalentPoolSuggestionDto
            {
                CvId = r.CvId,
                CandidateId = r.CandidateId,
                CandidateName = r.CandidateName,
                CandidateEmail = r.CandidateEmail,
                Score = score,
                CosineDistance = Math.Round(r.Distance, 4),
                UploadedAt = r.UploadedAt,
                AgeDays = ageDays,
                AgeText = DescribeAge(ageDays)
            };
        }).ToList();

        _logger.Information("TalentPool: job {JobId} gợi ý {Count} CV (trong {Months} tháng).",
            jobId, suggestions.Count, withinMonths);

        return new TalentPoolResultDto
        {
            JobId = jobId,
            WithinMonths = withinMonths,
            Count = suggestions.Count,
            Suggestions = suggestions
        };
    }

    // ============================================================

    /// <summary>"Tuổi CV" dễ đọc, vd "nộp 5 ngày trước" / "nộp 3 tháng trước".</summary>
    private static string? DescribeAge(int? ageDays)
    {
        if (ageDays is not int d) return null;
        if (d <= 0) return "nộp hôm nay";
        if (d < 30) return $"nộp {d} ngày trước";
        var months = d / 30;
        return $"nộp {months} tháng trước";
    }

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };
}
