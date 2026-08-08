using System.Globalization;
using System.Text;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos.Business.Cv;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Lib.Services.Ai;
using GP35.SRIS.Storage;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Nhận hồ sơ ứng tuyển: lưu file CV gốc lên storage, bóc text từ PDF, tạo Candidate +
/// CvDocument + Application (NEW). KHÔNG chấm điểm — hệ thống không xếp hạng ứng viên thay người.
/// </summary>
public class CvIntakeService : BaseService<CvIntakeService>, ICvIntakeService
{
    private readonly IPdfTextExtractor _pdfExtractor;
    private readonly ICandidateRepo _candidateRepo;
    private readonly IJobRepo _jobRepo;
    private readonly ICvDocumentRepo _cvRepo;
    private readonly IApplicationRepo _applicationRepo;
    private readonly IFileStorageService _fileStorage;
    private readonly ILogger _logger;

    public CvIntakeService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _pdfExtractor = serviceProvider.GetRequiredService<IPdfTextExtractor>();
        _candidateRepo = serviceProvider.GetRequiredService<ICandidateRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _cvRepo = serviceProvider.GetRequiredService<ICvDocumentRepo>();
        _applicationRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _fileStorage = serviceProvider.GetRequiredService<IFileStorageService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CvIntakeService>();
    }

    public async Task<CvUploadResultDto> UploadCvAsync(
        long companyId, long jobId, string candidateName, string candidateEmail, string? candidatePhone,
        string fileName, string? mimeType, byte[] fileBytes)
    {
        // (0) Tạo/lấy ứng viên + lưu file CV gốc lên MinIO trước (dùng cho mọi nhánh kết quả).
        var candidateId = await UpsertCandidateAsync(companyId, candidateName, candidateEmail, candidatePhone);
        var fileUrl = await StoreOriginalFileAsync(companyId, candidateId, fileName, mimeType, fileBytes);

        // (1) PDF -> text. File hỏng -> lưu CV trạng thái FAILED, KHÔNG làm sập API.
        PdfExtractResult extract;
        try
        {
            extract = _pdfExtractor.Extract(fileBytes);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "UploadCv: không đọc được PDF {FileName}", fileName);
            var cvIdFailed = await _cvRepo.InsertAsync(BuildCvDoc(companyId, candidateId, fileUrl, fileName,
                mimeType, fileBytes.Length, extractedText: null, CvParseStatus.Failed), embedding: null);
            return new CvUploadResultDto
            {
                Status = CvIntakeStatus.Failed,
                Reason = "Không đọc được file PDF (file hỏng hoặc không đúng định dạng).",
                CandidateId = candidateId,
                CvId = cvIdFailed,
                CandidateName = candidateName
            };
        }

        // (2) PDF scan ảnh — không có lớp text -> chuyển luồng nhập tay, chưa tạo hồ sơ.
        if (extract.Kind == PdfKind.NeedsManualEdit)
        {
            var cvId = await _cvRepo.InsertAsync(
                BuildCvDoc(companyId, candidateId, fileUrl, fileName, mimeType, fileBytes.Length,
                    extract.Text, CvParseStatus.NeedsManualEdit),
                embedding: null);

            return new CvUploadResultDto
            {
                Status = CvIntakeStatus.NeedsManualEdit,
                Reason = "CV này là bản scan ảnh (PDF không có lớp text). " +
                         "Hệ thống không đọc tự động được — vui lòng nhập thông tin thủ công.",
                CandidateId = candidateId,
                CvId = cvId,
                CandidateName = candidateName,
                PageCount = extract.PageCount,
                CharCount = extract.CharCount
            };
        }

        // (3) Đọc được text -> lưu CV + tạo hồ sơ ở NEW.
        var result = await SaveApplicationAsync(companyId, jobId, candidateId, candidateName,
            extract.Text, fileUrl, fileName, mimeType, fileBytes.Length);

        result.PageCount = extract.PageCount;
        result.CharCount = extract.CharCount;
        result.ExtractPreview = extract.Text.Length > 200 ? extract.Text[..200] + "..." : extract.Text;
        return result;
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

    // ============================================================

    /// <summary>
    /// Lưu file CV gốc lên MinIO. Storage lỗi thì log và trả null — vẫn nhận hồ sơ,
    /// chỉ là không có link file gốc (text đã bóc vẫn còn trong DB).
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
            _logger.Warning(ex, "UploadCv: lưu file CV gốc lên storage thất bại (vẫn nhận hồ sơ).");
            return null;
        }
    }

    private async Task<CvUploadResultDto> SaveApplicationAsync(
        long companyId, long jobId, long candidateId, string candidateName,
        string cvText, string? fileUrl, string? fileName, string? mimeType, int? fileSize)
    {
        // Kiểm job hợp lệ TRƯỚC khi ghi hồ sơ — tránh đẻ ra Application trỏ vào job không tồn tại.
        var job = await _jobRepo.GetByIdAsync(companyId, jobId);
        if (job is null)
        {
            return new CvUploadResultDto
            {
                Status = CvIntakeStatus.Failed,
                Reason = $"Không tìm thấy Job (jobId={jobId}) trong công ty này.",
                CandidateId = candidateId,
                CandidateName = candidateName
            };
        }

        var cvDoc = BuildCvDoc(companyId, candidateId, fileUrl, fileName, mimeType, fileSize, cvText, CvParseStatus.Ok);
        var cvId = await _cvRepo.InsertAsync(cvDoc, embedding: null);

        var applicationId = await _applicationRepo.InsertAsync(companyId, new Domain.Entities.Application
        {
            JobId = jobId,
            CandidateId = candidateId,
            CvId = cvId,
            CurrentState = ApplicationState.New
        });

        _logger.Information("UploadCv: nhận hồ sơ app={AppId} job={JobId} cv={CvId}.",
            applicationId, jobId, cvId);

        return new CvUploadResultDto
        {
            Status = CvIntakeStatus.Received,
            ApplicationId = applicationId,
            CandidateId = candidateId,
            CvId = cvId,
            CandidateName = candidateName
        };
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
}
