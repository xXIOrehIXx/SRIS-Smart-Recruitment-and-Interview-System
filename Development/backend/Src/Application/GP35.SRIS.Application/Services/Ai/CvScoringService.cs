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
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CvScoringService>();
    }

    public async Task<CvScoreResultDto> ScoreUploadedCvAsync(
        long companyId, long jobId, string candidateName, string candidateEmail,
        string fileName, string? mimeType, byte[] fileBytes)
    {
        // (0) Tạo/lấy ứng viên + lưu file CV gốc lên MinIO trước (dùng cho mọi nhánh kết quả).
        var candidateId = await UpsertCandidateAsync(companyId, candidateName, candidateEmail);
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

        // --- Loại 1 + 2: bóc được text -> chấm điểm ---
        var result = await ScoreCoreAsync(companyId, jobId, candidateId, candidateName,
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

    public async Task<CvScoreResultDto> ScoreCvTextAsync(long companyId, CvScoreTextRequest request)
    {
        var candidateId = await UpsertCandidateAsync(companyId, request.CandidateName, request.CandidateEmail);
        return await ScoreCoreAsync(companyId, request.JobId, candidateId, request.CandidateName,
            request.CvText, fileUrl: null, fileName: null, mimeType: null, fileSize: null);
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
            CurrentState = r.CurrentState
        });
    }

    public async Task<string?> GetCvFileUrlAsync(long companyId, long cvId)
    {
        var info = await _cvRepo.GetFileInfoAsync(companyId, cvId);
        if (info is null || string.IsNullOrWhiteSpace(info.FileUrl))
            return null;

        return await _fileStorage.GetPresignedUrlAsync(info.FileUrl);
    }

    // ============================================================
    //  Luồng lõi: embed CV -> lazy embed JD -> lưu CV + Application
    //  -> VECTOR_DISTANCE -> quy đổi điểm -> lưu điểm. Dùng chung cho text & PDF.
    // ============================================================
    private async Task<CvScoreResultDto> ScoreCoreAsync(
        long companyId, long jobId, long candidateId, string candidateName,
        string cvText, string? fileUrl, string? fileName, string? mimeType, int? fileSize)
    {
        // (1) Job tồn tại? + JD đã có embedding chưa
        var jobInfo = await _jobRepo.GetEmbeddingInfoAsync(companyId, jobId);
        if (jobInfo is null)
        {
            return new CvScoreResultDto
            {
                Status = CvParseStatus.Failed,
                Reason = $"Không tìm thấy Job (jobId={jobId}) trong công ty này.",
                CandidateId = candidateId,
                CandidateName = candidateName
            };
        }

        // (2) Lazy embedding cho JD (chỉ chạy 1 lần/job)
        if (!jobInfo.HasEmbedding)
        {
            if (string.IsNullOrWhiteSpace(jobInfo.JdText))
            {
                return new CvScoreResultDto
                {
                    Status = CvParseStatus.Failed,
                    Reason = "Job chưa có mô tả công việc (jd_text) nên không thể chấm điểm.",
                    CandidateId = candidateId,
                    CandidateName = candidateName
                };
            }

            var jdVector = await _embeddingClient.EmbedAsync(jobInfo.JdText);
            await _jobRepo.UpdateEmbeddingAsync(companyId, jobId, jdVector);
        }

        // (3) Sinh embedding cho CV + lưu CvDocument
        var cvVector = await _embeddingClient.EmbedAsync(cvText);
        var cvDoc = BuildCvDoc(companyId, candidateId, fileUrl, fileName, mimeType, fileSize, cvText, CvParseStatus.Ok);
        var cvId = await _cvRepo.InsertAsync(cvDoc, cvVector);

        // (4) Tạo hồ sơ ứng tuyển
        var applicationId = await _applicationRepo.InsertAsync(companyId, new Domain.Entities.Application
        {
            JobId = jobId,
            CandidateId = candidateId,
            CvId = cvId,
            CurrentState = ApplicationState.New
        });

        // (5) Đo khoảng cách cosine CV <-> JD ngay trong SQL Server
        var distance = await _applicationRepo.GetCvJdCosineDistanceAsync(companyId, cvId, jobId);

        // (6) Quy đổi khoảng cách -> điểm 0-100 (distance nhỏ = giống nhiều = điểm cao)
        var score = Math.Clamp((decimal)Math.Round((1.0 - distance) * 100.0, 2), 0m, 100m);

        // (7) Lưu điểm
        await _applicationRepo.UpdateScoreAsync(companyId, applicationId, score);

        return new CvScoreResultDto
        {
            Status = "SCORED",
            ApplicationId = applicationId,
            CandidateId = candidateId,
            CvId = cvId,
            CandidateName = candidateName,
            Score = score,
            CosineDistance = Math.Round(distance, 4)
        };
    }

    /// <summary>Tìm ứng viên theo email; chưa có thì tạo mới. Trả về candidate_id.</summary>
    private async Task<long> UpsertCandidateAsync(long companyId, string fullName, string email)
    {
        var existing = await _candidateRepo.GetByEmailAsync(companyId, email);
        if (existing is not null)
            return existing.CandidateId;

        return await _candidateRepo.InsertAsync(companyId, new Candidate
        {
            FullName = fullName,
            Email = email
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
