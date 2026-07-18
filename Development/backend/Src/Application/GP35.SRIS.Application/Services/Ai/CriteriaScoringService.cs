using System.Globalization;
using System.Text;
using GP35.SRIS.Application.Contracts.Dtos.Ai.Criteria;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Lib.Services.Ai;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Ai;

/// <summary>
/// Chấm CV theo TỪNG tiêu chí (docs 5.18). "AI chỉ ra bằng chứng, con người phán":
/// - HARD: lọc rule/keyword trên text CV (vector so ngữ nghĩa dễ sai với yêu cầu cứng).
/// - SOFT: embed tiêu chí (lazy) + embed từng đoạn CV -> cosine, mỗi tiêu chí lấy đoạn
///   khớp nhất làm bằng chứng; >= ngưỡng = KHỚP.
/// - Điểm = tổng CÓ TRỌNG SỐ các tiêu chí khớp / tổng trọng số, trên nhóm CV_MATCHABLE.
/// Ngưỡng + cách chunk là điểm khởi đầu — PoC Việc B4 đo rồi mới khóa số.
/// </summary>
public class CriteriaScoringService : BaseService<CriteriaScoringService>, ICriteriaScoringService
{
    private const int EvidenceMaxChars = 600;

    private readonly IApplicationRepo _appRepo;
    private readonly ICvDocumentRepo _cvRepo;
    private readonly ICvChunkRepo _chunkRepo;
    private readonly IEvaluationCriteriaRepo _criteriaRepo;
    private readonly IApplicationCriterionMatchRepo _matchRepo;
    private readonly IEmbeddingClient _embeddingClient;
    private readonly DefaultConfig _config;
    private readonly ILogger _logger;

    public CriteriaScoringService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _cvRepo = serviceProvider.GetRequiredService<ICvDocumentRepo>();
        _chunkRepo = serviceProvider.GetRequiredService<ICvChunkRepo>();
        _criteriaRepo = serviceProvider.GetRequiredService<IEvaluationCriteriaRepo>();
        _matchRepo = serviceProvider.GetRequiredService<IApplicationCriterionMatchRepo>();
        _embeddingClient = serviceProvider.GetRequiredService<IEmbeddingClient>();
        _config = serviceProvider.GetRequiredService<DefaultConfig>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CriteriaScoringService>();
    }

    public async Task ScoreByCriteriaAsync(long companyId, long applicationId)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId);
        if (app is null)
        {
            _logger.Warning("CriteriaScoring: không thấy hồ sơ app={AppId} — bỏ qua.", applicationId);
            return;
        }

        // Chỉ chấm nhóm CV_MATCHABLE (tránh loại oan vì thứ CV không thể hiện — 5.18).
        var criteria = (await _criteriaRepo.GetByJobAsync(companyId, app.JobId, activeOnly: true))
            .Where(c => c.CvMatchable)
            .ToList();
        if (criteria.Count == 0)
        {
            _logger.Information("CriteriaScoring: job {JobId} chưa có tiêu chí đã duyệt — bỏ qua app={AppId}.",
                app.JobId, applicationId);
            return;
        }

        var cvText = await _cvRepo.GetExtractedTextAsync(companyId, app.CvId);
        if (string.IsNullOrWhiteSpace(cvText))
        {
            _logger.Warning("CriteriaScoring: CV {CvId} chưa có text — bỏ qua app={AppId}.", app.CvId, applicationId);
            return;
        }

        await EnsureCvChunksAsync(companyId, app.CvId, cvText);
        await EnsureCriteriaEmbeddingsAsync(companyId, app.JobId, criteria);

        // SOFT: mỗi tiêu chí đi tìm đoạn CV khớp nhất (VECTOR_DISTANCE trong SQL Server).
        var softRows = await _criteriaRepo.GetBestChunkPerSoftCriterionAsync(companyId, app.JobId, app.CvId);
        var softByCriteria = softRows.ToDictionary(r => r.CriteriaId);
        var threshold = _config.AiService?.CriteriaMatchThreshold ?? 0.6;

        var now = DateTime.UtcNow;
        var matches = new List<ApplicationCriterionMatch>();
        foreach (var c in criteria)
        {
            if (string.Equals(c.CriteriaType, CriteriaType.Hard, StringComparison.OrdinalIgnoreCase))
            {
                var (matched, evidence) = MatchHardByKeywords(cvText, c);
                matches.Add(new ApplicationCriterionMatch
                {
                    CriteriaId = c.CriteriaId,
                    Matched = matched,
                    Similarity = null,
                    Evidence = evidence,
                    EvaluatedAt = now
                });
            }
            else
            {
                softByCriteria.TryGetValue(c.CriteriaId, out var best);
                var similarity = best is null ? 0.0 : 1.0 - best.Distance;
                matches.Add(new ApplicationCriterionMatch
                {
                    CriteriaId = c.CriteriaId,
                    Matched = similarity >= threshold,
                    Similarity = (decimal)Math.Round(Math.Clamp(similarity, 0, 1), 4),
                    // Thiếu vẫn lưu đoạn GẦN NHẤT — người đọc thấy ngay "CV nói gần nhất là gì".
                    Evidence = Truncate(best?.Content),
                    EvaluatedAt = now
                });
            }
        }

        // Điểm tổng = tổng có trọng số các tiêu chí khớp (docs 5.18). Tiêu chí HARD rớt tự kéo
        // điểm xuống + hiển thị cờ đỏ; hệ thống KHÔNG auto-reject — người sàng lọc quyết.
        var totalWeight = criteria.Sum(c => c.Weight);
        var matchedWeight = criteria
            .Where(c => matches.First(m => m.CriteriaId == c.CriteriaId).Matched)
            .Sum(c => c.Weight);
        var score = totalWeight <= 0 ? 0m : Math.Round(matchedWeight / totalWeight * 100m, 2);

        await _matchRepo.ReplaceForApplicationAsync(companyId, applicationId, matches);
        await _appRepo.UpdateCriteriaScoreAsync(companyId, applicationId, score);

        _logger.Information(
            "CriteriaScoring: app={AppId} job={JobId} -> score={Score} ({Matched}/{Total} tiêu chí khớp).",
            applicationId, app.JobId, score, matches.Count(m => m.Matched), matches.Count);
    }

    public async Task<CriteriaMatchResultDto> GetMatchesAsync(long companyId, long applicationId)
    {
        var rows = await _matchRepo.GetByApplicationAsync(companyId, applicationId);
        var app = await _appRepo.GetByIdAsync(companyId, applicationId);

        return new CriteriaMatchResultDto
        {
            ApplicationId = applicationId,
            CriteriaScore = app?.CriteriaScore,
            HardPassed = rows
                .Where(r => string.Equals(r.CriteriaType, CriteriaType.Hard, StringComparison.OrdinalIgnoreCase))
                .All(r => r.Matched),
            EvaluatedAt = rows.Count > 0 ? rows.Max(r => r.EvaluatedAt) : null,
            Matches = rows.Select(r => new CriterionMatchDto
            {
                CriteriaId = r.CriteriaId,
                Name = r.CriteriaName,
                Type = r.CriteriaType,
                Weight = r.Weight,
                Matched = r.Matched,
                Similarity = r.Similarity,
                Evidence = r.Evidence
            }).ToList()
        };
    }

    // ============================================================

    /// <summary>Chunk + embed từng đoạn CV nếu chưa có (tầng vector thứ 2 — không đụng tầng cả-CV).</summary>
    private async Task EnsureCvChunksAsync(long companyId, long cvId, string cvText)
    {
        if (await _chunkRepo.HasEmbeddedChunksAsync(companyId, cvId)) return;

        var pieces = CvChunker.Split(cvText);
        var chunks = new List<(string Content, float[] Embedding)>(pieces.Count);
        foreach (var piece in pieces)
            chunks.Add((piece, await _embeddingClient.EmbedAsync(piece)));

        await _chunkRepo.ReplaceChunksAsync(companyId, cvId, chunks);
        _logger.Information("CriteriaScoring: chunk CV {CvId} thành {N} đoạn + embed.", cvId, chunks.Count);
    }

    /// <summary>Lazy embedding cho tiêu chí SOFT (như JD — chỉ 1 lần, sửa tiêu chí thì embed lại).</summary>
    private async Task EnsureCriteriaEmbeddingsAsync(
        long companyId, long jobId, IReadOnlyList<EvaluationCriteria> criteria)
    {
        var missing = await _criteriaRepo.GetSoftCriteriaNeedingEmbeddingAsync(companyId, jobId);
        foreach (var criteriaId in missing)
        {
            var crit = criteria.FirstOrDefault(c => c.CriteriaId == criteriaId);
            if (crit is null) continue;
            var vector = await _embeddingClient.EmbedAsync(crit.Name);
            await _criteriaRepo.UpdateEmbeddingAsync(companyId, criteriaId, vector);
        }
    }

    /// <summary>
    /// Tiêu chí HARD: tìm keyword trong text CV (so cả bản bỏ dấu — CV hay viết không dấu).
    /// Khớp -> bằng chứng = đoạn text quanh vị trí tìm thấy.
    /// </summary>
    internal static (bool Matched, string? Evidence) MatchHardByKeywords(string cvText, EvaluationCriteria c)
    {
        var keywords = (string.IsNullOrWhiteSpace(c.Keywords) ? c.Name : c.Keywords)
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var textLower = cvText.ToLowerInvariant();
        var textAscii = RemoveDiacritics(textLower);

        foreach (var keyword in keywords)
        {
            var kwLower = keyword.ToLowerInvariant();
            var idx = textLower.IndexOf(kwLower, StringComparison.Ordinal);
            if (idx < 0)
                idx = textAscii.IndexOf(RemoveDiacritics(kwLower), StringComparison.Ordinal);
            if (idx < 0) continue;

            // Bằng chứng: cửa sổ ±120 ký tự quanh keyword (cắt trên text GỐC — giữ nguyên dấu).
            var start = Math.Max(0, idx - 120);
            var length = Math.Min(cvText.Length - start, kwLower.Length + 240);
            var evidence = (start > 0 ? "…" : "") + cvText.Substring(start, length).Trim() +
                           (start + length < cvText.Length ? "…" : "");
            return (true, Truncate(evidence));
        }
        return (false, null);
    }

    /// <summary>Bỏ dấu tiếng Việt (đ/Đ xử lý riêng) — RemoveDiacritics("kế toán") = "ke toan".</summary>
    internal static string RemoveDiacritics(string text)
    {
        var decomposed = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).Replace('đ', 'd').Replace('Đ', 'D');
    }

    private static string? Truncate(string? text) =>
        string.IsNullOrWhiteSpace(text) ? null
        : text.Length <= EvidenceMaxChars ? text
        : text[..EvidenceMaxChars] + "…";
}
