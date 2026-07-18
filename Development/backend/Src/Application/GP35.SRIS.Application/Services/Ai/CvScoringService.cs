using System.Globalization;
using System.Text;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos.Ai;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Lib.Services.Ai;
using GP35.SRIS.Storage;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Ai;

public class CvScoringService : BaseService<CvScoringService>, ICvScoringService
{
    private readonly IPdfTextExtractor _pdfExtractor;
    private readonly IEmbeddingClient _embeddingClient;
    private readonly ICandidateRepo _candidateRepo;
    private readonly IJobRepo _jobRepo;
    private readonly ICvDocumentRepo _cvRepo;
    private readonly IApplicationRepo _applicationRepo;
    private readonly IFileStorageService _fileStorage;
    private readonly ICvScoreQueue _cvScoreQueue;
    private readonly ILogger _logger;

    public CvScoringService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _pdfExtractor = serviceProvider.GetRequiredService<IPdfTextExtractor>();
        _embeddingClient = serviceProvider.GetRequiredService<IEmbeddingClient>();
        _candidateRepo = serviceProvider.GetRequiredService<ICandidateRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _cvRepo = serviceProvider.GetRequiredService<ICvDocumentRepo>();
        _applicationRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _fileStorage = serviceProvider.GetRequiredService<IFileStorageService>();
        _cvScoreQueue = serviceProvider.GetRequiredService<ICvScoreQueue>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CvScoringService>();
    }

    public async Task<CvScoreResultDto> ScoreUploadedCvAsync(
        long companyId, long jobId, string candidateName, string candidateEmail, string? candidatePhone,
        string fileName, string? mimeType, byte[] fileBytes)
    {
        // (0) Tạo/lấy ứng viên + lưu file CV gốc lên MinIO trước (dùng cho mọi nhánh kết quả).
        var candidateId = await UpsertCandidateAsync(companyId, candidateName, candidateEmail, candidatePhone);
        var fileUrl = await StoreOriginalFileAsync(companyId, candidateId, fileName, mimeType, fileBytes);

        // --- Bước "PDF -> text" đứng TRƯỚC luồng AI ---
        PdfExtractResult extract;
        try
        {
            extract = _pdfExtractor.Extract(fileBytes);
        }
        catch (Exception ex)
        {
            // File hỏng / không phải PDF hợp lệ -> không làm sập API, lưu CV trạng thái FAILED.
            _logger.Warning(ex, "ScoreUploadedCv: không đọc được PDF {FileName}", fileName);
            var cvIdFailed = await _cvRepo.InsertAsync(BuildCvDoc(companyId, candidateId, fileUrl, fileName,
                mimeType, fileBytes.Length, extractedText: null, CvParseStatus.Failed), embedding: null);
            return new CvScoreResultDto
            {
                Status = CvParseStatus.Failed,
                Reason = "Không đọc được file PDF (file hỏng hoặc không đúng định dạng).",
                CandidateId = candidateId,
                CvId = cvIdFailed,
                CandidateName = candidateName
            };
        }

        // --- Loại 3: PDF scan ảnh — text rỗng -> chuyển luồng Manual Edit (không chấm) ---
        if (extract.Kind == PdfKind.NeedsManualEdit)
        {
            var cvId = await _cvRepo.InsertAsync(
                BuildCvDoc(companyId, candidateId, fileUrl, fileName, mimeType, fileBytes.Length,
                    extract.Text, CvParseStatus.NeedsManualEdit),
                embedding: null);

            return new CvScoreResultDto
            {
                Status = CvParseStatus.NeedsManualEdit,
                Reason = "CV này là bản scan ảnh (PDF không có lớp text). " +
                         "Hệ thống không đọc tự động được — vui lòng nhập thông tin thủ công.",
                CandidateId = candidateId,
                CvId = cvId,
                CandidateName = candidateName,
                PageCount = extract.PageCount,
                CharCount = extract.CharCount
            };
        }

        // --- Loại 1 + 2: bóc được text -> LƯU hồ sơ (chưa chấm) + đẩy vào hàng đợi chấm nền (Cách A) ---
        var result = await SaveForScoringAsync(companyId, jobId, candidateId, candidateName,
            extract.Text, fileUrl, fileName, mimeType, fileBytes.Length);

        result.PageCount = extract.PageCount;
        result.CharCount = extract.CharCount;
        result.ExtractPreview = extract.Text.Length > 200 ? extract.Text[..200] + "..." : extract.Text;
        return result;
    }

    /// <summary>
    /// Lưu file CV gốc lên MinIO. Không chặn luồng chấm điểm: nếu storage lỗi thì log và trả null
    /// (vẫn chấm điểm bình thường, chỉ là không có link file gốc).
    /// </summary>
    private async Task<string?> StoreOriginalFileAsync(
        long companyId, long candidateId, string fileName, string? mimeType, byte[] fileBytes)
    {
        try
        {
            var ext = Path.GetExtension(fileName);
            if (string.IsNullOrWhiteSpace(ext)) ext = ".pdf";
            var objectName = $"cv/{companyId}/{candidateId}/{Guid.NewGuid():N}{ext}";

            using var ms = new MemoryStream(fileBytes);
            var stored = await _fileStorage.UploadAsync(
                objectName, ms, fileBytes.Length, mimeType ?? "application/pdf");
            return stored.ObjectName;
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "ScoreUploadedCv: lưu file CV gốc lên storage thất bại (vẫn tiếp tục chấm điểm).");
            return null;
        }
    }

    public async Task<IEnumerable<CandidateRankingDto>> GetRankingAsync(long companyId, long jobId)
    {
        var rows = await _applicationRepo.GetRankingByJobAsync(companyId, jobId);
        return rows.Select(r => new CandidateRankingDto
        {
            ApplicationId = r.ApplicationId,
            CandidateId = r.CandidateId,
            CandidateName = r.CandidateName,
            Score = r.AiMatchScore,
            CurrentState = r.CurrentState,
            CvId = r.CvId
        });
    }

    public async Task<string?> GetCvFileUrlAsync(long companyId, long cvId)
    {
        var info = await _cvRepo.GetFileInfoAsync(companyId, cvId);
        if (info is null || string.IsNullOrWhiteSpace(info.FileUrl))
            return null;

        var downloadName = BuildCvDownloadName(info.CandidateName, info.FileName);
        var contentType = string.IsNullOrWhiteSpace(info.MimeType) ? "application/pdf" : info.MimeType;
        return await _fileStorage.GetPresignedUrlAsync(
            info.FileUrl, downloadFileName: downloadName, contentType: contentType);
    }

    /// <summary>
    /// Tên file khi tải về: "CV_&lt;tên ứng viên&gt;.pdf" — bỏ dấu tiếng Việt + ký tự lạ
    /// để an toàn cho HTTP header (vd "Nguyễn Văn A" -> "CV_Nguyen_Van_A.pdf").
    /// </summary>
    private static string BuildCvDownloadName(string? candidateName, string? originalFileName)
    {
        var raw = string.IsNullOrWhiteSpace(candidateName) ? "candidate" : candidateName;

        // Bỏ dấu: tách dấu (FormD) rồi loại ký tự dấu (NonSpacingMark), xử lý riêng đ/Đ.
        var decomposed = raw.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var ch in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        var ascii = sb.ToString().Normalize(NormalizationForm.FormC)
            .Replace('đ', 'd').Replace('Đ', 'D');

        // Chỉ giữ chữ/số; còn lại -> '_'; gộp '_' thừa.
        var clean = new string(ascii.Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray()).Trim('_');
        while (clean.Contains("__")) clean = clean.Replace("__", "_");
        if (string.IsNullOrWhiteSpace(clean)) clean = "candidate";

        var ext = Path.GetExtension(originalFileName);
        if (string.IsNullOrWhiteSpace(ext)) ext = ".pdf";

        return $"CV_{clean}{ext}";
    }

    // ============================================================
    //  Cách A — pha "LƯU" (đồng bộ, trong request nộp CV):
    //  kiểm job hợp lệ (KHÔNG gọi AI) -> lưu CV (chưa embedding) + hồ sơ NEW (chưa điểm)
    //  -> đẩy vào hàng đợi chấm nền -> trả PENDING ngay. KHÔNG bắt ứng viên đợi AI.
    // ============================================================
    private async Task<CvScoreResultDto> SaveForScoringAsync(
        long companyId, long jobId, long candidateId, string candidateName,
        string cvText, string? fileUrl, string? fileName, string? mimeType, int? fileSize)
    {
        // (1) Kiểm job hợp lệ + có JD (đọc nhẹ, KHÔNG gọi AI) -> fail SỚM để ứng viên biết ngay,
        //     tránh tạo hồ sơ "treo" không bao giờ chấm được.
        var jobInfo = await _jobRepo.GetEmbeddingInfoAsync(companyId, jobId);
        if (jobInfo is null)
        {
            return new CvScoreResultDto
            {
                Status = CvScoreStatus.Failed,
                Reason = $"Không tìm thấy Job (jobId={jobId}) trong công ty này.",
                CandidateId = candidateId,
                CandidateName = candidateName
            };
        }
        if (string.IsNullOrWhiteSpace(jobInfo.JdText))
        {
            return new CvScoreResultDto
            {
                Status = CvScoreStatus.Failed,
                Reason = "Job chưa có mô tả công việc (jd_text) nên không thể chấm điểm.",
                CandidateId = candidateId,
                CandidateName = candidateName
            };
        }

        // (2) Lưu CV (parse OK, embedding NULL) + hồ sơ ứng tuyển (NEW, điểm NULL)
        var cvDoc = BuildCvDoc(companyId, candidateId, fileUrl, fileName, mimeType, fileSize, cvText, CvParseStatus.Ok);
        var cvId = await _cvRepo.InsertAsync(cvDoc, embedding: null);

        var applicationId = await _applicationRepo.InsertAsync(companyId, new Domain.Entities.Application
        {
            JobId = jobId,
            CandidateId = candidateId,
            CvId = cvId,
            CurrentState = ApplicationState.New
        });

        // (3) Đẩy vào hàng đợi chấm nền — KHÔNG đợi (Cách A). Worker sẽ embed + tính điểm sau.
        _cvScoreQueue.Enqueue(companyId, applicationId);

        return new CvScoreResultDto
        {
            Status = CvScoreStatus.Pending,
            ApplicationId = applicationId,
            CandidateId = candidateId,
            CvId = cvId,
            CandidateName = candidateName
        };
    }

    // ============================================================
    //  Cách A — pha "CHẤM" (chạy nền, ngoài request): embed CV -> lazy embed JD
    //  -> VECTOR_DISTANCE -> quy đổi điểm -> lưu điểm. Gọi bởi CvScoringWorker.
    // ============================================================
    public async Task ScoreApplicationAsync(long companyId, long applicationId)
    {
        var app = await _applicationRepo.GetByIdAsync(companyId, applicationId);
        if (app is null)
        {
            _logger.Warning("ScoreApplication: không thấy hồ sơ app={AppId} (company={Co}) — bỏ qua.",
                applicationId, companyId);
            return;
        }

        var cvText = await _cvRepo.GetExtractedTextAsync(companyId, app.CvId);
        if (string.IsNullOrWhiteSpace(cvText))
        {
            _logger.Warning("ScoreApplication: CV {CvId} của hồ sơ {AppId} chưa có text — bỏ qua.",
                app.CvId, applicationId);
            return;
        }

        var jobInfo = await _jobRepo.GetEmbeddingInfoAsync(companyId, app.JobId);
        if (jobInfo is null)
        {
            _logger.Warning("ScoreApplication: không thấy Job {JobId} của hồ sơ {AppId} — bỏ qua.",
                app.JobId, applicationId);
            return;
        }

        // Lazy embedding cho JD (chỉ 1 lần/job)
        if (!jobInfo.HasEmbedding)
        {
            if (string.IsNullOrWhiteSpace(jobInfo.JdText))
            {
                _logger.Warning("ScoreApplication: Job {JobId} thiếu jd_text — không chấm được hồ sơ {AppId}.",
                    app.JobId, applicationId);
                return;
            }

            var jdVector = await _embeddingClient.EmbedAsync(jobInfo.JdText);
            await _jobRepo.UpdateEmbeddingAsync(companyId, app.JobId, jdVector);
        }

        // Embed CV -> cập nhật vector cho CvDocument đã lưu
        var cvVector = await _embeddingClient.EmbedAsync(cvText);
        await _cvRepo.UpdateEmbeddingAsync(companyId, app.CvId, cvVector);

        // Đo cosine CV <-> JD trong SQL Server -> quy đổi điểm 0-100 (distance nhỏ = giống nhiều) -> lưu
        var distance = await _applicationRepo.GetCvJdCosineDistanceAsync(companyId, app.CvId, app.JobId);
        var score = Math.Clamp((decimal)Math.Round((1.0 - distance) * 100.0, 2), 0m, 100m);
        await _applicationRepo.UpdateScoreAsync(companyId, applicationId, score);

        _logger.Information("ScoreApplication: app={AppId} job={JobId} cv={CvId} -> score={Score} (dist={Dist}).",
            applicationId, app.JobId, app.CvId, score, Math.Round(distance, 4));

        // Tầng 2 — chấm theo TỪNG tiêu chí (5.18). Best-effort: job chưa có tiêu chí thì service
        // tự bỏ qua; lỗi tầng này KHÔNG được phá điểm cả-CV vừa lưu.
        try
        {
            var criteriaScoring = _serviceProvider.GetRequiredService<ICriteriaScoringService>();
            await criteriaScoring.ScoreByCriteriaAsync(companyId, applicationId);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "ScoreApplication: chấm theo tiêu chí thất bại (app={AppId}) — giữ điểm cả-CV.",
                applicationId);
        }
    }

    /// <summary>Tìm ứng viên theo email; chưa có thì tạo mới. Trả về candidate_id.</summary>
    private async Task<long> UpsertCandidateAsync(
        long companyId, string fullName, string email, string? phone = null)
    {
        var existing = await _candidateRepo.GetByEmailAsync(companyId, email);
        if (existing is not null)
            return existing.CandidateId;

        return await _candidateRepo.InsertAsync(companyId, new Candidate
        {
            FullName = fullName,
            Email = email,
            Phone = phone,
            Source = "Career Site"
        });
    }

    private static CvDocument BuildCvDoc(
        long companyId, long candidateId, string? fileUrl, string? fileName, string? mimeType,
        int? fileSize, string? extractedText, string parseStatus) => new()
    {
        CompanyId = companyId,
        CandidateId = candidateId,
        FileUrl = fileUrl,
        FileName = fileName,
        MimeType = mimeType,
        FileSize = fileSize,
        ExtractedText = extractedText,
        ParseStatus = parseStatus
    };
}
