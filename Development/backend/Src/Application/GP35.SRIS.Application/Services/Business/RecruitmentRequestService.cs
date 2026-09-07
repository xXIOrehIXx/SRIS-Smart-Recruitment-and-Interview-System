using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Request;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Yêu cầu tuyển dụng (docs 5.17). DM ra đề → GIÁM ĐỐC duyệt (V047) → Human Resource tạo Job
/// từ yêu cầu (CONVERTED).
/// Chỉ sửa/hủy khi còn PENDING; duyệt xong không sửa nội dung nữa (giữ audit "đề bài gốc").
/// </summary>
public class RecruitmentRequestService : BaseService<RecruitmentRequestService>, IRecruitmentRequestService
{
    private readonly IRecruitmentRequestRepo _requestRepo;
    private readonly IJobRepo _jobRepo;
    private readonly IContextData _contextData;
    private readonly ILogger _logger;

    public RecruitmentRequestService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _requestRepo = serviceProvider.GetRequiredService<IRecruitmentRequestRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _contextData = serviceProvider.GetRequiredService<IContextData>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<RecruitmentRequestService>();
    }

    public async Task<RecruitmentRequestDto> CreateAsync(long companyId, long userId, RecruitmentRequestInputDto dto)
    {
        Validate(dto);

        var request = new RecruitmentRequest
        {
            Title = dto.Title.Trim(),
            Department = Clean(dto.Department),
            Location = Clean(dto.Location),
            Quantity = dto.Quantity > 0 ? dto.Quantity : 1,
            EmploymentType = Clean(dto.EmploymentType),
            ExperienceLevel = Clean(dto.ExperienceLevel),
            ExperienceYearsMin = dto.ExperienceYearsMin,
            Description = Clean(dto.Description),
            Requirements = Clean(dto.Requirements),
            Benefits = Clean(dto.Benefits),
            SalaryMin = dto.SalaryMin,
            SalaryMax = dto.SalaryMax,
            ExpectedStartDate = dto.ExpectedStartDate,
            Deadline = dto.Deadline,
            Status = "PENDING",
            CreatedBy = userId > 0 ? userId : null
        };
        var requestId = await _requestRepo.InsertAsync(companyId, request);

        _logger.Information("RecruitmentRequest: DM {UserId} tạo yêu cầu id={RequestId} '{Title}'.",
            userId, requestId, request.Title);

        return await GetByIdAsync(companyId, requestId);
    }

    public async Task<IReadOnlyList<RecruitmentRequestDto>> GetListAsync(long companyId, string? status)
    {
        var rows = await _requestRepo.GetListAsync(companyId, Clean(status)?.ToUpperInvariant());
        return rows.Select(r => Map(r.Request, r.CreatedByName, r.ReviewedByName)).ToList();
    }

    public async Task<RecruitmentRequestDto> GetByIdAsync(long companyId, long requestId)
    {
        var rows = await _requestRepo.GetListAsync(companyId, null);
        var row = rows.FirstOrDefault(r => r.Request.RequestId == requestId)
            ?? throw NotFound($"Không tìm thấy yêu cầu tuyển dụng (request_id={requestId}).");
        return Map(row.Request, row.CreatedByName, row.ReviewedByName);
    }

    public async Task<RecruitmentRequestDto> UpdateAsync(
        long companyId, long userId, long requestId, RecruitmentRequestInputDto dto)
    {
        Validate(dto);
        var request = await GetPendingAsync(companyId, requestId, "sửa");

        request.Title = dto.Title.Trim();
        request.Department = Clean(dto.Department);
        request.Location = Clean(dto.Location);
        request.Quantity = dto.Quantity > 0 ? dto.Quantity : 1;
        request.EmploymentType = Clean(dto.EmploymentType);
        request.ExperienceLevel = Clean(dto.ExperienceLevel);
        request.ExperienceYearsMin = dto.ExperienceYearsMin;
        request.Description = Clean(dto.Description);
        request.Requirements = Clean(dto.Requirements);
        request.Benefits = Clean(dto.Benefits);
        request.SalaryMin = dto.SalaryMin;
        request.SalaryMax = dto.SalaryMax;
        request.ExpectedStartDate = dto.ExpectedStartDate;
        request.Deadline = dto.Deadline;
        request.UpdatedAt = DateTime.UtcNow;
        await _requestRepo.SaveAsync();

        return await GetByIdAsync(companyId, requestId);
    }

    public async Task CancelAsync(long companyId, long userId, long requestId)
    {
        var request = await GetPendingAsync(companyId, requestId, "hủy");
        request.Status = "CANCELLED";
        request.UpdatedAt = DateTime.UtcNow;
        await _requestRepo.SaveAsync();

        _logger.Information("RecruitmentRequest: user {UserId} hủy yêu cầu id={RequestId}.", userId, requestId);
    }

    public async Task<RecruitmentRequestDto> ReviewAsync(
        long companyId, long userId, long requestId, ReviewRequestDto dto)
    {
        var request = await _requestRepo.GetByIdAsync(companyId, requestId)
            ?? throw NotFound($"Không tìm thấy yêu cầu tuyển dụng (request_id={requestId}).");
        if (request.Status != "PENDING")
            throw Conflict($"Chỉ duyệt được yêu cầu đang PENDING (hiện tại: {request.Status}).");
        // Note tùy chọn (kể cả khi từ chối) — DM hỏi lại trực tiếp được, không cần ép nhập.
        request.Status = dto.Approve ? "APPROVED" : "REJECTED";
        request.ReviewNote = Clean(dto.Note);
        request.ReviewedBy = userId > 0 ? userId : null;
        request.ReviewedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        await _requestRepo.SaveAsync();

        _logger.Information("RecruitmentRequest: Giám đốc {UserId} {Action} yêu cầu id={RequestId}.",
            userId, request.Status, requestId);

        return await GetByIdAsync(companyId, requestId);
    }

    // ConvertAsync đã bỏ ở V056. Việc "gắn job vào yêu cầu" giờ nằm trong chính lượt TẠO TIN
    // (JobService.CreateAsync -> AttachRequestAsync): tin tuyển dụng luôn sinh ra từ một yêu cầu
    // đã duyệt, và cùng lúc đó bộ tiêu chí Trưởng bộ phận đã chốt chuyển sang tin để thành phiếu
    // chấm phỏng vấn. Tách lại thành hai bước là mở lại khoảng thời gian tin đã tồn tại mà chưa
    // có phiếu chấm, và bước sau hỏng thì không ai biết.

    // ============================================================

    private async Task<RecruitmentRequest> GetPendingAsync(long companyId, long requestId, string action)
    {
        var request = await _requestRepo.GetByIdAsync(companyId, requestId)
            ?? throw NotFound($"Không tìm thấy yêu cầu tuyển dụng (request_id={requestId}).");
        if (request.Status != "PENDING")
            throw Conflict($"Chỉ {action} được yêu cầu đang PENDING (hiện tại: {request.Status}).");
        return request;
    }

    private static void Validate(RecruitmentRequestInputDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            throw Bad("Tiêu đề yêu cầu tuyển dụng không được để trống.");
        if (dto.SalaryMin.HasValue && dto.SalaryMax.HasValue && dto.SalaryMin > dto.SalaryMax)
            throw Bad("Lương tối thiểu không được lớn hơn lương tối đa.");
        // Khớp CK_RecruitReq_exp_years (V024) — chặn ở đây để trả 400 có thông điệp,
        // không để DB ném CHECK violation thành 500.
        if (dto.ExperienceYearsMin is < 0 or > 50)
            throw Bad("Số năm kinh nghiệm phải trong khoảng 0–50.");
        // Ngày cần tuyển ở quá khứ là gõ nhầm năm/tháng — để lọt thì Human Resource đọc xong
        // không biết deadline thật là bao giờ. So ở mức NGÀY (ô này không nhập giờ).
        if (dto.ExpectedStartDate is { } start && start.Date < DateTime.UtcNow.Date)
            throw Bad($"Ngày cần tuyển ({start:dd/MM/yyyy}) đã ở quá khứ — chọn ngày từ hôm nay trở đi.");
        // Hạn nộp đơn (V048) — cùng luật với Job.deadline, vì nó chép thẳng sang tin tuyển dụng.
        if (dto.Deadline is { } deadline && deadline.Date < DateTime.UtcNow.Date)
            throw Bad($"Hạn nộp đơn ({deadline:dd/MM/yyyy}) đã ở quá khứ — chọn ngày từ hôm nay trở đi.");
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static RecruitmentRequestDto Map(RecruitmentRequest r, string? createdByName, string? reviewedByName) => new()
    {
        RequestId = r.RequestId,
        Title = r.Title,
        Department = r.Department,
        Location = r.Location,
        Quantity = r.Quantity,
        EmploymentType = r.EmploymentType,
        ExperienceLevel = r.ExperienceLevel,
        ExperienceYearsMin = r.ExperienceYearsMin,
        Description = r.Description,
        Requirements = r.Requirements,
        Benefits = r.Benefits,
        SalaryMin = r.SalaryMin,
        SalaryMax = r.SalaryMax,
        ExpectedStartDate = r.ExpectedStartDate,
        Deadline = r.Deadline,
        Status = r.Status,
        ReviewNote = r.ReviewNote,
        ReviewedByName = reviewedByName,
        ReviewedAt = r.ReviewedAt,
        JobId = r.JobId,
        CreatedBy = r.CreatedBy,
        CreatedByName = createdByName,
        CreatedAt = r.CreatedAt
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
}
