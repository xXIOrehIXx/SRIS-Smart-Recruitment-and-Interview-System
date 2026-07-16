using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Offer (docs 5.15). Người quyết tuyển chốt offer tại cửa INTERVIEW->OFFER: đẩy state sang OFFER
/// (state machine lo Guard G2) + tạo OfferDetail (PENDING) + phát magic link OFFER_RESPONSE.
/// </summary>
public class OfferService : BaseService<OfferService>, IOfferService
{
    private const string Purpose = "OFFER_RESPONSE";
    private const int DefaultOfferTtlDays = 7; // khớp TTL link OFFER_RESPONSE (5.13)

    private readonly IApplicationRepo _appRepo;
    private readonly IJobRepo _jobRepo;
    private readonly IOfferRepo _offerRepo;
    private readonly IApplicationStateService _stateService;
    private readonly IMagicLinkService _magicLink;
    private readonly INotificationService _notification;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly ILogger _logger;

    public OfferService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _offerRepo = serviceProvider.GetRequiredService<IOfferRepo>();
        _stateService = serviceProvider.GetRequiredService<IApplicationStateService>();
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _notification = serviceProvider.GetRequiredService<INotificationService>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<OfferService>();
    }

    public async Task<MakeOfferResultDto> MakeOfferAsync(
        long companyId, long userId, long applicationId, MakeOfferDto dto)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        // Một offer / một application (UNIQUE application_id — 5.15).
        if (await _offerRepo.GetByApplicationAsync(companyId, applicationId) is not null)
            throw Conflict("Hồ sơ này đã có offer.");

        // Phân quyền: chỉ Department Manager của job quyết; job không gán DM -> Recruiter (bất kỳ user) quyết (5.14).
        var job = await _jobRepo.GetByIdAsync(companyId, app.JobId)
            ?? throw NotFound("Không tìm thấy vị trí (job) của hồ sơ.");
        if (job.DepartmentManagerId is long dmId && dmId != userId)
            throw Forbidden("Chỉ Department Manager của vị trí này mới được quyết offer.");

        // Quyết tuyển = đẩy INTERVIEW->OFFER. State machine kiểm forward-only + Guard G2 (≥1 phiếu chấm đã nộp).
        await _stateService.TransitionAsync(companyId, userId, applicationId, ApplicationState.Offer, null);

        var now = DateTime.UtcNow;
        var ttlDays = dto.ExpiresInDays is int d && d > 0 ? d : DefaultOfferTtlDays;
        var offer = new OfferDetail
        {
            ApplicationId = applicationId,
            SalaryAmount = dto.SalaryAmount,
            Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "VND" : dto.Currency.Trim().ToUpperInvariant(),
            StartDate = dto.StartDate,
            Note = dto.Note,
            DecidedBy = userId > 0 ? userId : null,
            Status = OfferStatus.Pending,
            SentAt = now,
            ExpiresAt = now.AddDays(ttlDays)
        };
        offer.OfferId = await _offerRepo.InsertAsync(companyId, offer);

        // Phát magic link OFFER_RESPONSE cho ứng viên (token gốc chỉ có ở đây — gửi qua email).
        var issued = await _magicLink.IssueAsync(companyId, applicationId, Purpose, TimeSpan.FromDays(ttlDays));

        // Gửi email cho ứng viên với magic link
        try
        {
            await _notification.SendMagicLinkAsync(companyId, applicationId, Purpose, issued.RawToken, issued.ExpiresAt);
        }
        catch (Exception ex)
        {
            // Best-effort: lỗi gửi mail không ảnh hưởng đến việc tạo offer
            _logger.Warning(ex, "Offer: không gửi được email OFFER_RESPONSE cho app={AppId}", applicationId);
        }

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "OFFER_MADE",
            Detail = offer.SalaryAmount is decimal s ? $"{s:0} {offer.Currency}" : offer.Currency
        });

        _logger.Information("Offer: hồ sơ {AppId} ra offer (offer_id={OfferId}, hạn {Expires:O}).",
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

    // ============================================================

    private static OfferDto Map(OfferDetail o) => new()
    {
        OfferId = o.OfferId,
        ApplicationId = o.ApplicationId,
        SalaryAmount = o.SalaryAmount,
        Currency = o.Currency,
        StartDate = o.StartDate,
        Status = o.Status,
        Note = o.Note,
        DecidedBy = o.DecidedBy,
        SentAt = o.SentAt,
        ExpiresAt = o.ExpiresAt,
        RespondedAt = o.RespondedAt
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };

    private static BaseException Forbidden(string msg) => new(msg)
    {
        ErrorCode = "FORBIDDEN", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Forbidden
    };
}
