using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Cv;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Ai;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Tóm tắt CV bằng AI (V033) — cắt bước "tải PDF về rồi mới biết ứng viên có gì".
/// <para>
/// Ranh giới: chỉ trích xuất nội dung CV. KHÔNG chấm điểm, KHÔNG so với JD, KHÔNG xếp hạng.
/// Service này cố tình không đụng tới Job/EvaluationCriteria để ranh giới đó không trôi.
/// </para>
/// <para>
/// Tóm tắt được LƯU: LLM chạy local mất vài giây một lượt, không thể gọi lại mỗi lần mở hồ sơ.
/// </para>
/// </summary>
public class CvSummaryService : BaseService<CvSummaryService>, ICvSummaryService
{
    /// <summary>Ngắn hơn mức này thì CV coi như không có text (scan ảnh / parse hỏng).</summary>
    private const int MinTextLength = 100;

    private readonly ICvDocumentRepo _cvRepo;
    private readonly ICvSummaryClient _summaryClient;
    private readonly ILogger _logger;

    public CvSummaryService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _cvRepo = serviceProvider.GetRequiredService<ICvDocumentRepo>();
        _summaryClient = serviceProvider.GetRequiredService<ICvSummaryClient>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CvSummaryService>();
    }

    public async Task<CvSummaryDto> GetAsync(long companyId, long cvId)
    {
        var info = await _cvRepo.GetSummaryAsync(companyId, cvId)
            ?? throw NotFound($"Không tìm thấy CV (cv_id={cvId}).");

        return new CvSummaryDto
        {
            CvId = cvId,
            Highlights = SplitLines(info.Summary),
            GeneratedAt = info.SummaryAt,
            CanSummarize = HasEnoughText(info.ExtractedText)
        };
    }

    public async Task<CvSummaryDto> GenerateAsync(long companyId, long cvId)
    {
        var info = await _cvRepo.GetSummaryAsync(companyId, cvId)
            ?? throw NotFound($"Không tìm thấy CV (cv_id={cvId}).");

        if (!HasEnoughText(info.ExtractedText))
            throw Bad("CV này không có nội dung dạng chữ để tóm tắt " +
                      "(bản scan ảnh hoặc file đọc không được).");

        IReadOnlyList<string> highlights;
        try
        {
            highlights = await _summaryClient.SummarizeAsync(info.ExtractedText!);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "Tóm tắt CV thất bại (cv_id={CvId}).", cvId);
            throw new BaseException(ex.Message)
            {
                ErrorCode = "AI_UNAVAILABLE",
                ErrorMessage = "Chưa tóm tắt được CV lúc này — dịch vụ AI không phản hồi. " +
                               "Bạn vẫn mở được file CV gốc.",
                HttpStatus = (int)HttpStatusCode.ServiceUnavailable
            };
        }

        var summary = string.Join("\n", highlights);
        await _cvRepo.UpdateSummaryAsync(companyId, cvId, summary);

        _logger.Information("Đã tóm tắt CV cv_id={CvId} ({Count} ý).", cvId, highlights.Count);

        return new CvSummaryDto
        {
            CvId = cvId,
            Highlights = highlights.ToList(),
            GeneratedAt = DateTime.UtcNow,
            CanSummarize = true
        };
    }

    // ============================================================

    private static bool HasEnoughText(string? text) =>
        !string.IsNullOrWhiteSpace(text) && text.Trim().Length >= MinTextLength;

    private static List<string> SplitLines(string? summary) =>
        string.IsNullOrWhiteSpace(summary)
            ? new List<string>()
            : summary.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
