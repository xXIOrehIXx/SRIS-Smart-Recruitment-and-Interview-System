using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Candidate.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Pdf;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.CandidatePortal;

/// <summary>
/// Ứng viên xem/tải thư mời nhận việc qua magic link OFFER_RESPONSE (docs 5.15). Self-service, không login.
///
/// KHÔNG đốt token ở đây: "one-time = đốt khi CHỐT" (5.13) mà trang này không chốt gì cả —
/// ứng viên trả lời ngoài hệ thống. Đốt token khi mở sẽ khiến họ mất luôn bản thư đã nhận.
/// </summary>
public class CandidateOfferService : BaseService<CandidateOfferService>, ICandidateOfferService
{
    private const string Purpose = "OFFER_RESPONSE";

    private readonly IMagicLinkService _magicLink;
    private readonly IOfferRepo _offerRepo;
    private readonly IApplicationRepo _appRepo;
    private readonly ICompanyRepo _companyRepo;
    private readonly IOfferLetterPdfGenerator _pdf;
    private readonly ILogger _logger;

    public CandidateOfferService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _offerRepo = serviceProvider.GetRequiredService<IOfferRepo>();
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _companyRepo = serviceProvider.GetRequiredService<ICompanyRepo>();
        _pdf = serviceProvider.GetRequiredService<IOfferLetterPdfGenerator>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<CandidateOfferService>();
    }

    public async Task<CandidateOfferDto> GetOfferAsync(string rawToken)
    {
        var v = await _magicLink.ValidateAsync(rawToken, Purpose);

        var offer = await _offerRepo.GetByApplicationAsync(v.CompanyId, v.ApplicationId)
            ?? throw Conflict("Chưa có thư mời nhận việc cho hồ sơ này.");

        var info = await _appRepo.GetContactInfoAsync(v.CompanyId, v.ApplicationId);
        var company = await _companyRepo.GetByCompanyId(v.CompanyId);

        return new CandidateOfferDto
        {
            CompanyName = company?.Name,
            CandidateName = info?.CandidateName,
            JobTitle = offer.JobTitle ?? info?.JobTitle,
            Department = offer.Department,
            StartDate = offer.StartDate,
            EmploymentType = offer.EmploymentType,
            WorkLocation = offer.WorkLocation,

            SalaryAmount = offer.SalaryAmount,
            Currency = offer.Currency,
            SalaryPeriod = offer.SalaryPeriod,

            HrContactName = offer.HrContactName,
            HrContactEmail = offer.HrContactEmail,
            ExpiresAt = offer.ExpiresAt
        };
    }

    public async Task<(byte[] Content, string FileName)> GetLetterPdfAsync(string rawToken)
    {
        var v = await _magicLink.ValidateAsync(rawToken, Purpose);

        var offer = await _offerRepo.GetByApplicationAsync(v.CompanyId, v.ApplicationId)
            ?? throw Conflict("Chưa có thư mời nhận việc cho hồ sơ này.");

        var info = await _appRepo.GetContactInfoAsync(v.CompanyId, v.ApplicationId);
        var company = await _companyRepo.GetByCompanyId(v.CompanyId);

        var model = OfferService.BuildLetterModel(offer, company, info?.CandidateName);

        _logger.Information("Offer: ứng viên tải thư mời (offer_id={OfferId}, app={AppId}).",
            offer.OfferId, v.ApplicationId);

        return (_pdf.Generate(model), _pdf.BuildFileName(model));
    }

    // ============================================================

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
