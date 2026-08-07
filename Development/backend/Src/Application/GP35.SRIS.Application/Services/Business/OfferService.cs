using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Pdf;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Thư mời nhận việc (docs 5.15). Recruiter/DM soạn thư cho hồ sơ đang ở trạng thái OFFER
/// (đã được người quyết duyệt) → lưu OfferDetail + phát magic link OFFER_RESPONSE; link đó mở
/// ra file PDF thư mời chứ không phải trang bấm Đồng ý/Từ chối.
///
/// Ứng viên trả lời NGOÀI hệ thống; Recruiter/DM ghi nhận kết quả bằng <see cref="RecordOutcomeAsync"/>.
/// </summary>
public class OfferService : BaseService<OfferService>, IOfferService
{
    private const string Purpose = "OFFER_RESPONSE";
    private const int DefaultOfferTtlDays = 7; // khớp TTL link OFFER_RESPONSE (5.13)

    private readonly IApplicationRepo _appRepo;
    private readonly IJobRepo _jobRepo;
    private readonly IOfferRepo _offerRepo;
    private readonly ICompanyRepo _companyRepo;
    private readonly IUserRepo _userRepo;
    private readonly IApplicationStateService _stateService;
    private readonly IMagicLinkService _magicLink;
    private readonly IOfferLetterPdfGenerator _pdf;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly IContextData _contextData;
    private readonly ILogger _logger;

    public OfferService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _contextData = serviceProvider.GetRequiredService<IContextData>();
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _offerRepo = serviceProvider.GetRequiredService<IOfferRepo>();
        _companyRepo = serviceProvider.GetRequiredService<ICompanyRepo>();
        _userRepo = serviceProvider.GetRequiredService<IUserRepo>();
        _stateService = serviceProvider.GetRequiredService<IApplicationStateService>();
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _pdf = serviceProvider.GetRequiredService<IOfferLetterPdfGenerator>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<OfferService>();
    }

    public async Task<OfferLetterDefaultsDto> GetLetterDefaultsAsync(long companyId, long applicationId)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        var info = await _appRepo.GetContactInfoAsync(companyId, applicationId);
        var job = await _jobRepo.GetByIdAsync(companyId, app.JobId);
        var company = await _companyRepo.GetByCompanyId(companyId);

        // Người ký mặc định = người đang soạn thư; "Báo cáo cho" = DM sở hữu job (nếu có).
        var signer = _contextData.UserId > 0
            ? await _userRepo.GetByIdAsync(companyId, _contextData.UserId)
            : null;
        var manager = job?.DepartmentManagerId is long dmId
            ? await _userRepo.GetByIdAsync(companyId, dmId)
            : null;

        return new OfferLetterDefaultsDto
        {
            CompanyName = company?.Name,
            CompanyAddress = company?.Address,
            CompanyEmail = company?.ContactEmail,
            CompanyPhone = company?.Phone,

            CandidateName = info?.CandidateName,
            CandidateEmail = info?.CandidateEmail,

            JobTitle = job?.Title ?? info?.JobTitle,
            Department = job?.Department,
            ReportingTo = manager?.FullName,
            EmploymentType = job?.EmploymentType,
            WorkLocation = job?.Location,
            SalaryAmount = job?.SalaryMax ?? job?.SalaryMin,
            Currency = string.IsNullOrWhiteSpace(job?.Currency) ? "VND" : job!.Currency,
            SalaryPeriod = SalaryPeriods.Month,
            Terms = OfferLetterPdfGenerator.DefaultTerms,
            SignerName = signer?.FullName,
            SignerTitle = signer is null ? null : RoleTitle(signer.Role),
            HrContactName = signer?.FullName,
            HrContactEmail = signer?.Email ?? company?.ContactEmail,
            ExpiresInDays = DefaultOfferTtlDays
        };
    }

    public async Task<MakeOfferResultDto> MakeOfferAsync(
        long companyId, long userId, long applicationId, MakeOfferDto dto)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        if (!string.Equals(app.CurrentState, ApplicationState.Offer, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Hồ sơ chưa được Department Manager duyệt (phải ở trạng thái OFFER mới được gửi thư mời).");

        // Một offer / một application (UNIQUE application_id — 5.15).
        if (await _offerRepo.GetByApplicationAsync(companyId, applicationId) is not null)
            throw Conflict("Hồ sơ này đã được gửi thư mời nhận việc.");

        // Ô nào để trống thì lấy mặc định từ Job/Company — người soạn không phải gõ lại.
        var defaults = await GetLetterDefaultsAsync(companyId, applicationId);

        var now = DateTime.UtcNow;
        var ttlDays = dto.ExpiresInDays is int d && d > 0 ? d : DefaultOfferTtlDays;
        var offer = new OfferDetail
        {
            ApplicationId = applicationId,
            Status = OfferStatus.Pending,
            DecidedBy = userId > 0 ? userId : null,
            SentAt = now,
            ExpiresAt = now.AddDays(ttlDays),

            JobTitle = Pick(dto.JobTitle, defaults.JobTitle),
            Department = Pick(dto.Department, defaults.Department),
            ReportingTo = Pick(dto.ReportingTo, defaults.ReportingTo),
            StartDate = dto.StartDate,
            EmploymentType = Pick(dto.EmploymentType, defaults.EmploymentType),
            WorkLocation = Pick(dto.WorkLocation, defaults.WorkLocation),

            SalaryAmount = dto.SalaryAmount,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "VND" : dto.Currency.Trim().ToUpperInvariant(),
            SalaryPeriod = NormalizeSalaryPeriod(dto.SalaryPeriod),
            Bonus = Trim(dto.Bonus),
            Benefits = Trim(dto.Benefits),

            Terms = Pick(dto.Terms, OfferLetterPdfGenerator.DefaultTerms),
            HrContactName = Pick(dto.HrContactName, defaults.HrContactName),
            HrContactEmail = Pick(dto.HrContactEmail, defaults.HrContactEmail),
            SignerName = Pick(dto.SignerName, defaults.SignerName),
            SignerTitle = Pick(dto.SignerTitle, defaults.SignerTitle),
            CandidateAddress = Trim(dto.CandidateAddress),
            Note = Trim(dto.Note)
        };
        offer.OfferId = await _offerRepo.InsertAsync(companyId, offer);

        // Phát magic link (token gốc chỉ có ở đây — gửi qua email). IssueAsync ĐÃ tự gửi email
        // kèm nút "Xem thư mời nhận việc" và tự nuốt lỗi gửi mail -> KHÔNG gọi SendMagicLinkAsync
        // lần nữa ở đây, không thì ứng viên nhận 2 mail giống hệt.
        var issued = await _magicLink.IssueAsync(companyId, applicationId, Purpose, TimeSpan.FromDays(ttlDays));

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "OFFER_LETTER_SENT",
            Detail = offer.SalaryAmount is decimal s ? $"{s:0} {offer.Currency}" : offer.Currency
        });

        _logger.Information("Offer: gửi thư mời hồ sơ {AppId} (offer_id={OfferId}, hạn {Expires:O}).",
            applicationId, offer.OfferId, offer.ExpiresAt);

        return new MakeOfferResultDto
        {
            Offer = Map(offer),
            MagicToken = issued.RawToken,
            TokenExpiresAt = issued.ExpiresAt
        };
    }

    public async Task<OfferDto?> GetByApplicationAsync(long companyId, long applicationId)
    {
        var offer = await _offerRepo.GetByApplicationAsync(companyId, applicationId);
        return offer is null ? null : Map(offer);
    }

    public async Task<(byte[] Content, string FileName)?> GetLetterPdfAsync(long companyId, long applicationId)
    {
        var offer = await _offerRepo.GetByApplicationAsync(companyId, applicationId);
        if (offer is null) return null;

        var info = await _appRepo.GetContactInfoAsync(companyId, applicationId);
        var company = await _companyRepo.GetByCompanyId(companyId);

        var model = BuildLetterModel(offer, company, info?.CandidateName);
        return (_pdf.Generate(model), _pdf.BuildFileName(model));
    }

    public async Task<OfferOutcomeResultDto> RecordOutcomeAsync(
        long companyId, long userId, long applicationId, OfferOutcomeDto dto)
    {
        var offer = await _offerRepo.GetByApplicationAsync(companyId, applicationId)
            ?? throw Conflict("Hồ sơ này chưa được gửi thư mời nhận việc.");

        if (!string.Equals(offer.Status, OfferStatus.Pending, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Kết quả của thư mời này đã được ghi nhận trước đó.");

        // Chặn TRƯỚC khi động vào offer: nếu hồ sơ không còn ở OFFER thì transition bên dưới
        // sẽ ném, mà lúc đó offer đã bị đánh dấu ACCEPTED/DECLINED -> offer một đằng, hồ sơ
        // một nẻo. Kiểm ở đây để hai bảng không bao giờ lệch nhau.
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");
        if (!string.Equals(app.CurrentState, ApplicationState.Offer, StringComparison.OrdinalIgnoreCase))
            throw Conflict($"Hồ sơ không còn ở bước Quyết định (đang ở {app.CurrentState}) — không ghi nhận được kết quả thư mời.");

        var now = DateTime.UtcNow;
        var newStatus = dto.Accepted ? OfferStatus.Accepted : OfferStatus.Declined;
        var note = Trim(dto.Note);

        // Khóa lạc quan: chỉ chốt khi còn PENDING (chống hai người bấm cùng lúc).
        var rows = await _offerRepo.SetOutcomeAsync(
            companyId, offer.OfferId, newStatus, userId > 0 ? userId : null, note, now);
        if (rows == 0)
            throw Conflict("Kết quả của thư mời này đã được ghi nhận trước đó.");

        // Đồng bộ pipeline: ACCEPTED -> HIRED, DECLINED -> REJECTED (5.15).
        // State machine tự ghi ActivityLog STATE_CHANGE + gửi email kết quả cho ứng viên.
        // isCandidateAnswer: đây là GHI NHẬN câu trả lời của ứng viên, không phải quyết định
        // tuyển mới -> không áp luật "chỉ DM của job" (5.14), nếu không thì job có gán DM sẽ
        // kẹt: Recruiter cầm email trả lời của ứng viên mà không được phép gõ vào hệ thống.
        string appState;
        if (dto.Accepted)
        {
            await _stateService.TransitionAsync(
                companyId, userId, applicationId, ApplicationState.Hired, null, isCandidateAnswer: true);
            appState = ApplicationState.Hired;
        }
        else
        {
            await _stateService.TransitionAsync(
                companyId, userId, applicationId, ApplicationState.Rejected,
                note ?? "Ứng viên từ chối thư mời nhận việc.", isCandidateAnswer: true);
            appState = ApplicationState.Rejected;
        }

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = dto.Accepted ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
            Detail = note
        });

        _logger.Information("Offer: ghi nhận kết quả {Status} (offer_id={OfferId}, app={AppId}).",
            newStatus, offer.OfferId, applicationId);

        return new OfferOutcomeResultDto { OfferStatus = newStatus, ApplicationState = appState };
    }

    // ============================================================

    /// <summary>Gộp OfferDetail + Company thành dữ liệu in thư (thứ tự ưu tiên: nội dung đã lưu ở offer).</summary>
    internal static OfferLetterModel BuildLetterModel(OfferDetail o, Company? company, string? candidateName)
        => new()
        {
            CompanyName = company?.Name,
            CompanyAddress = company?.Address,
            CompanyEmail = company?.ContactEmail,
            CompanyPhone = company?.Phone,
            LetterDate = o.SentAt ?? o.CreatedAt ?? DateTime.UtcNow,

            CandidateName = candidateName,
            CandidateAddress = o.CandidateAddress,

            JobTitle = o.JobTitle,
            Department = o.Department,
            ReportingTo = o.ReportingTo,
            StartDate = o.StartDate,
            EmploymentType = o.EmploymentType,
            WorkLocation = o.WorkLocation,

            SalaryAmount = o.SalaryAmount,
            Currency = o.Currency,
            SalaryPeriod = o.SalaryPeriod,
            Bonus = o.Bonus,
            Benefits = o.Benefits,

            Terms = o.Terms,
            AcceptanceDeadline = o.ExpiresAt,
            HrContactName = o.HrContactName,
            HrContactEmail = o.HrContactEmail,
            SignerName = o.SignerName,
            SignerTitle = o.SignerTitle,
            Note = o.Note
        };

    private static OfferDto Map(OfferDetail o) => new()
    {
        OfferId = o.OfferId,
        ApplicationId = o.ApplicationId,
        Status = o.Status,

        JobTitle = o.JobTitle,
        Department = o.Department,
        ReportingTo = o.ReportingTo,
        StartDate = o.StartDate,
        EmploymentType = o.EmploymentType,
        WorkLocation = o.WorkLocation,

        SalaryAmount = o.SalaryAmount,
        Currency = o.Currency,
        SalaryPeriod = o.SalaryPeriod,
        Bonus = o.Bonus,
        Benefits = o.Benefits,

        Terms = o.Terms,
        HrContactName = o.HrContactName,
        HrContactEmail = o.HrContactEmail,
        SignerName = o.SignerName,
        SignerTitle = o.SignerTitle,
        CandidateAddress = o.CandidateAddress,
        Note = o.Note,

        DecidedBy = o.DecidedBy,
        OutcomeBy = o.OutcomeBy,
        OutcomeNote = o.OutcomeNote,
        SentAt = o.SentAt,
        ExpiresAt = o.ExpiresAt,
        RespondedAt = o.RespondedAt
    };

    /// <summary>Chức danh gợi ý cho người ký, suy từ role (người soạn sửa lại được).</summary>
    private static string? RoleTitle(string? role) => (role ?? "").Trim() switch
    {
        RoleConstants.Admin => "Quản trị viên",
        RoleConstants.Recruiter => "Chuyên viên tuyển dụng",
        RoleConstants.DepartmentManager => "Trưởng bộ phận",
        RoleConstants.Interviewer => "Người phỏng vấn",
        _ => null
    };

    private static string? NormalizeSalaryPeriod(string? period)
        => (period ?? "").Trim().ToUpperInvariant() switch
        {
            SalaryPeriods.Year => SalaryPeriods.Year,
            SalaryPeriods.Month => SalaryPeriods.Month,
            _ => SalaryPeriods.Month
        };

    /// <summary>Người soạn để trống -> dùng giá trị mặc định lấy từ Job/Company.</summary>
    private static string? Pick(string? input, string? fallback)
        => string.IsNullOrWhiteSpace(input) ? Trim(fallback) : input.Trim();

    private static string? Trim(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
