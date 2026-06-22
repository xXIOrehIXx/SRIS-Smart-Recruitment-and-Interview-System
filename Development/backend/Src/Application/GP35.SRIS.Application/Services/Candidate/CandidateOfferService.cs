using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Candidate.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.CandidatePortal;

/// <summary>
/// Ứng viên tự nhận/từ chối offer qua magic link OFFER_RESPONSE (docs 5.15). Self-service, không login.
/// Đồng ý -> ACCEPTED + HIRED; Từ chối -> DECLINED + REJECTED. One-time đốt token khi CHỐT.
/// </summary>
public class CandidateOfferService : BaseService<CandidateOfferService>, ICandidateOfferService
{
    private const string Purpose = "OFFER_RESPONSE";

    private readonly IMagicLinkService _magicLink;
    private readonly IOfferRepo _offerRepo;
    private readonly IApplicationStateService _stateService;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly ILogger _logger;

    public CandidateOfferService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _offerRepo = serviceProvider.GetRequiredService<IOfferRepo>();
        _stateService = serviceProvider.GetRequiredService<IApplicationStateService>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CandidateOfferService>();
    }

    public async Task<CandidateOfferDto> GetOfferAsync(string rawToken)
    {
        var v = await _magicLink.ValidateAsync(rawToken, Purpose);

        var offer = await _offerRepo.GetByApplicationAsync(v.CompanyId, v.ApplicationId)
            ?? throw Conflict("Chưa có offer cho hồ sơ này.");

        return new CandidateOfferDto
        {
            SalaryAmount = offer.SalaryAmount,
            Currency = offer.Currency,
            StartDate = offer.StartDate,
            Status = offer.Status,
            ExpiresAt = offer.ExpiresAt
        };
    }

    public async Task<OfferResponseResultDto> RespondAsync(string rawToken, OfferResponseDto dto)
    {
        var v = await _magicLink.ValidateAsync(rawToken, Purpose);

        var offer = await _offerRepo.GetByApplicationAsync(v.CompanyId, v.ApplicationId)
            ?? throw Conflict("Chưa có offer cho hồ sơ này.");

        if (!string.Equals(offer.Status, OfferStatus.Pending, StringComparison.OrdinalIgnoreCase))
            throw Conflict("Offer này đã được phản hồi.");
        if (offer.ExpiresAt is DateTime exp && exp <= DateTime.UtcNow)
            throw Conflict("Offer đã hết hạn phản hồi.");

        var now = DateTime.UtcNow;
        var newStatus = dto.Accept ? OfferStatus.Accepted : OfferStatus.Declined;

        // Khóa lạc quan: chỉ chốt khi còn PENDING (chống double-submit).
        var rows = await _offerRepo.SetResponseAsync(v.CompanyId, offer.OfferId, newStatus, now);
        if (rows == 0)
            throw Conflict("Offer này đã được phản hồi.");

        // Đồng bộ pipeline: ACCEPTED -> HIRED, DECLINED -> REJECTED (5.15). State machine ghi ActivityLog STATE_CHANGE.
        string appState;
        if (dto.Accept)
        {
            await _stateService.TransitionAsync(v.CompanyId, 0, v.ApplicationId, ApplicationState.Hired, null);
            appState = ApplicationState.Hired;
        }
        else
        {
            await _stateService.TransitionAsync(
                v.CompanyId, 0, v.ApplicationId, ApplicationState.Rejected, "Ứng viên từ chối offer.");
            appState = ApplicationState.Rejected;
        }

        await _magicLink.MarkUsedAsync(v.CompanyId, v.TokenId); // one-time: đốt khi CHỐT (5.13)

        await _activityLogRepo.InsertAsync(v.CompanyId, new ActivityLog
        {
            ApplicationId = v.ApplicationId,
            Action = dto.Accept ? "OFFER_ACCEPTED" : "OFFER_DECLINED"
        });

        _logger.Information("Offer: ứng viên {Resp} offer (offer_id={OfferId}, app={AppId}).",
            newStatus, offer.OfferId, v.ApplicationId);

        return new OfferResponseResultDto
        {
            OfferStatus = newStatus,
            ApplicationState = appState
        };
    }

    // ============================================================

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
