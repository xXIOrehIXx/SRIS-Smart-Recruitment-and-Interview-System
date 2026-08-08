using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.CareerSite;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Ai;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.CandidatePortal;

/// <summary>
/// Career Site công khai (M1). Đọc job/brand đã bị giới hạn theo tenant (Global Query Filter + RLS,
/// companyId set ở middleware từ slug). Nộp CV tái dùng <see cref="ICvIntakeService"/> — cùng một
/// đường nhận hồ sơ với luồng Human Resource tự upload.
/// </summary>
public class CareerSiteService : BaseService<CareerSiteService>, ICareerSiteService
{
    private const string OpenStatus = "Open";
    private const string StatusPurpose = "STATUS";
    private const int StatusLinkTtlDays = 30;

    private readonly ICompanyRepo _companyRepo;
    private readonly IJobRepo _jobRepo;
    private readonly ICvIntakeService _cvIntake;
    private readonly IPdfTextExtractor _pdfExtractor;
    private readonly IMagicLinkService _magicLink;
    private readonly INotificationService _notification;
    private readonly ILogger _logger;

    public CareerSiteService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _companyRepo = serviceProvider.GetRequiredService<ICompanyRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _cvIntake = serviceProvider.GetRequiredService<ICvIntakeService>();
        _pdfExtractor = serviceProvider.GetRequiredService<IPdfTextExtractor>();
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _notification = serviceProvider.GetRequiredService<INotificationService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CareerSiteService>();
    }

    public async Task<PublicBrandDto?> GetBrandAsync(long companyId)
    {
        var company = await _companyRepo.GetByCompanyId(companyId);
        if (company is null) return null;

        return new PublicBrandDto
        {
            CompanyId = company.CompanyId,
            Name = company.Name,
            Slug = company.Slug,
            LogoUrl = company.LogoUrl,
            PrimaryColor = company.PrimaryColor
        };
    }

    public async Task<IEnumerable<PublicJobDto>> ListOpenJobsAsync(long companyId)
    {
        var jobs = await _jobRepo.GetListByCompanyAsync(companyId);
        var result = new List<PublicJobDto>();
        foreach (var j in jobs.Where(IsOpen))
        {
            var dto = await ToPublicDtoAsync(companyId, j);
            result.Add(dto);
        }
        return result;
    }

    public async Task<PublicJobDto?> GetOpenJobAsync(long companyId, long jobId)
    {
        var job = await _jobRepo.GetByIdAsync(companyId, jobId);
        if (job is null || !IsOpen(job)) return null;
        return await ToPublicDtoAsync(companyId, job);
    }

    public async Task<PublicApplyResultDto> ApplyAsync(
        long companyId, long jobId, string candidateName, string candidateEmail, string candidatePhone,
        string fileName, string? mimeType, byte[] fileBytes)
    {
        if (string.IsNullOrWhiteSpace(candidateName))
            throw Bad("Vui lòng nhập họ tên.");
        if (string.IsNullOrWhiteSpace(candidateEmail))
            throw Bad("Vui lòng nhập email.");
        if (string.IsNullOrWhiteSpace(candidatePhone))
            throw Bad("Vui lòng nhập số điện thoại.");

        // Chỉ cho nộp vào job đang mở (kiểm theo tenant hiện tại).
        var job = await _jobRepo.GetByIdAsync(companyId, jobId);
        if (job is null || !IsOpen(job))
            throw NotFound("Vị trí tuyển dụng không tồn tại hoặc đã đóng.");

        // ---- Chặn TRƯỚC khi ghi bất cứ gì ----
        // UploadCvAsync upsert Candidate + đẩy file lên MinIO RỒI mới bóc PDF, nên mọi nhánh hỏng
        // đều để lại candidate + file (và có khi cả CvDocument) mồ côi, không Application nào trỏ
        // tới. Với luồng HR tự upload thì CvDocument NEEDS_MANUAL_EDIT là chỗ để sửa tay, nhưng
        // career site không có ai sửa — và hiện chưa có API nào ghi lại extracted_text.
        // Kiểm hết điều kiện ở đây thì lần nộp hỏng không đẻ ra rác.
        EnsureReadableCv(fileBytes);

        var result = await _cvIntake.UploadCvAsync(
            companyId, jobId, candidateName.Trim(), candidateEmail.Trim(), candidatePhone.Trim(),
            fileName, mimeType, fileBytes);

        // Lưới an toàn: chỉ nhánh RECEIVED mới thực sự tạo hồ sơ, mọi status khác đều trả về KHÔNG
        // kèm application_id. Chặn theo ApplicationId chứ không liệt kê status — bỏ sót một status
        // là ứng viên nhận "đã nhận hồ sơ" trong khi KHÔNG có dòng Application nào, rồi magic link
        // STATUS vỡ FK (application_id = 0) và lỗi bị nuốt ở catch bên dưới.
        if (result.ApplicationId is not > 0)
        {
            var reason = result.Reason ?? "Không nhận được hồ sơ. Vui lòng thử lại hoặc nộp file PDF khác.";
            _logger.Warning("CareerSite: từ chối hồ sơ job={JobId} status={Status} — {Reason}",
                jobId, result.Status, reason);
            throw Bad(reason);
        }

        var applicationId = result.ApplicationId.Value;

        // Phát magic link STATUS để ứng viên theo dõi trạng thái.
        // IssueAsync đã tự gửi email kèm nút (5.13) -> không gửi lại, tránh 2 mail trùng.
        try
        {
            await _magicLink.IssueAsync(companyId, applicationId, StatusPurpose, TimeSpan.FromDays(StatusLinkTtlDays));
        }
        catch (Exception ex)
        {
            // Best-effort: lỗi gửi mail không ảnh hưởng đến việc nộp đơn
            _logger.Warning(ex, "CareerSite: không gửi được email xác nhận cho app={AppId}", applicationId);
        }

        _logger.Information("CareerSite: ứng viên nộp CV app={AppId} job={JobId} (điểm ẩn với ứng viên).",
            applicationId, jobId);

        return new PublicApplyResultDto
        {
            ApplicationId = applicationId
        };
    }

    /// <summary>
    /// Bóc thử PDF để loại CV không đọc được NGAY, trước khi có gì được ghi xuống DB/MinIO.
    /// Bóc 2 lần (ở đây + trong UploadCvAsync) rẻ hơn nhiều so với dọn rác về sau.
    /// </summary>
    private void EnsureReadableCv(byte[] fileBytes)
    {
        PdfExtractResult extract;
        try
        {
            extract = _pdfExtractor.Extract(fileBytes);
        }
        catch (Exception ex)
        {
            _logger.Warning(ex, "CareerSite: PDF hỏng — từ chối trước khi ghi.");
            throw Bad("Không đọc được file PDF (file hỏng hoặc không đúng định dạng). Vui lòng nộp lại.");
        }

        if (extract.Kind == PdfKind.NeedsManualEdit)
            throw Bad("CV của bạn là bản scan ảnh (PDF không có lớp chữ) nên hệ thống không đọc được " +
                      "nội dung. Vui lòng nộp lại file PDF có chữ (xuất từ Word / Google Docs).");
    }

    private static bool IsOpen(Job j) =>
        string.Equals(j.Status, OpenStatus, StringComparison.OrdinalIgnoreCase);

    private static PublicJobDto ToPublicDto(Job j) => new()
    {
        JobId = j.JobId,
        Title = j.Title,
        JdText = j.JdText,
        Status = j.Status,
        CreatedAt = j.CreatedAt
    };

    /// <summary>V020: build public DTO kèm requirements/benefits (chỉ field an toàn).</summary>
    private async Task<PublicJobDto> ToPublicDtoAsync(long companyId, Job j)
    {
        List<string> requirements = new();
        List<string> benefits = new();
        try
        {
            var reqs = await _jobRepo.GetRequirementsAsync(companyId, j.JobId);
            requirements = reqs.Select(r => r.Content).ToList();
            var bens = await _jobRepo.GetBenefitsAsync(companyId, j.JobId);
            benefits = bens.Select(b => b.Content).ToList();
        }
        catch
        {
            // bảng V020 có thể chưa tồn tại ở môi trường chưa migrate -> bỏ qua, không crash.
        }

        return new PublicJobDto
        {
            JobId = j.JobId,
            Title = j.Title,
            JdText = j.JdText,
            Status = j.Status,
            CreatedAt = j.CreatedAt,
            Department = j.Department,
            Location = j.Location,
            EmploymentType = j.EmploymentType,
            WorkMode = j.WorkMode,
            ExperienceLevel = j.ExperienceLevel,
            SalaryMin = j.SalaryMin,
            SalaryMax = j.SalaryMax,
            Deadline = j.Deadline,
            Requirements = requirements,
            Benefits = benefits,
            Skills = string.IsNullOrWhiteSpace(j.SkillTags)
                ? new List<string>()
                : j.SkillTags!.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList()
        };
    }

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
}
