using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.CandidatePortal;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Pdf;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Serilog;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// Cổng ứng viên (5.15) giờ CHỈ ĐỌC: xem tóm tắt + tải PDF thư mời. Không còn Đồng ý/Từ chối —
/// việc chốt HIRED/REJECTED nằm ở OfferService.RecordOutcomeAsync (Portal).
/// </summary>
public class CandidateOfferServiceTests
{
    private const string RawToken = "token123";
    private const long CompanyId = 1L;
    private const long AppId = 100L;
    private const long TokenId = 5L;

    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<IOfferRepo> _offerRepo = new();
    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<ICompanyRepo> _companyRepo = new();
    private readonly Mock<IOfferLetterPdfGenerator> _pdf = new();
    private readonly Mock<ILogger> _logger = new();

    private CandidateOfferService CreateService()
    {
        _logger.Setup(l => l.ForContext<CandidateOfferService>()).Returns(_logger.Object);

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_magicLink.Object);
            s.AddSingleton(_offerRepo.Object);
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_companyRepo.Object);
            s.AddSingleton(_pdf.Object);
            s.AddSingleton(_logger.Object);
        });
        return new CandidateOfferService(provider);
    }

    private void SetupValidToken() =>
        _magicLink.Setup(m => m.ValidateAsync(RawToken, "OFFER_RESPONSE"))
            .ReturnsAsync(new MagicLinkValidation(CompanyId, TokenId, AppId, "OFFER_RESPONSE"));

    [Fact]
    public async Task GetOfferAsync_Should_Return_Letter_Summary()
    {
        var svc = CreateService();
        SetupValidToken();

        _offerRepo.Setup(r => r.GetByApplicationAsync(CompanyId, AppId)).ReturnsAsync(new OfferDetail
        {
            OfferId = 10,
            Status = "PENDING",
            JobTitle = "Kế toán tổng hợp",
            Department = "Tài chính",
            SalaryAmount = 20_000_000,
            Currency = "VND",
            SalaryPeriod = "THANG",
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        });
        _appRepo.Setup(r => r.GetContactInfoAsync(CompanyId, AppId))
            .ReturnsAsync(new ApplicationContactInfo(AppId, "a@b.com", "Nguyễn Văn A", "Kế toán tổng hợp", "OFFER"));
        _companyRepo.Setup(r => r.GetByCompanyId(CompanyId))
            .ReturnsAsync(new Company { CompanyId = CompanyId, Name = "Công ty ABC" });

        var dto = await svc.GetOfferAsync(RawToken);

        Assert.Equal("Công ty ABC", dto.CompanyName);
        Assert.Equal("Nguyễn Văn A", dto.CandidateName);
        Assert.Equal("Kế toán tổng hợp", dto.JobTitle);
        Assert.Equal(20_000_000, dto.SalaryAmount);
        Assert.Equal("THANG", dto.SalaryPeriod);
    }

    [Fact]
    public async Task GetLetterPdfAsync_Should_Return_Pdf_And_Not_Burn_Token()
    {
        // Token KHÔNG bị đốt khi mở: ứng viên phải xem lại được thư suốt thời gian hiệu lực (5.13).
        var svc = CreateService();
        SetupValidToken();

        _offerRepo.Setup(r => r.GetByApplicationAsync(CompanyId, AppId))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "PENDING", Currency = "VND" });
        _appRepo.Setup(r => r.GetContactInfoAsync(CompanyId, AppId))
            .ReturnsAsync(new ApplicationContactInfo(AppId, "a@b.com", "Nguyễn Văn A", "Kế toán", "OFFER"));
        _companyRepo.Setup(r => r.GetByCompanyId(CompanyId)).ReturnsAsync(new Company { Name = "Công ty ABC" });
        _pdf.Setup(p => p.Generate(It.IsAny<OfferLetterModel>())).Returns(new byte[] { 1, 2, 3 });
        _pdf.Setup(p => p.BuildFileName(It.IsAny<OfferLetterModel>())).Returns("Thu-moi-nhan-viec-Nguyen-Van-A.pdf");

        var (content, fileName) = await svc.GetLetterPdfAsync(RawToken);

        Assert.Equal(new byte[] { 1, 2, 3 }, content);
        Assert.Equal("Thu-moi-nhan-viec-Nguyen-Van-A.pdf", fileName);
        _magicLink.Verify(m => m.MarkUsedAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task GetLetterPdfAsync_Should_Throw_Conflict_If_No_Offer_Yet()
    {
        var svc = CreateService();
        SetupValidToken();
        _offerRepo.Setup(r => r.GetByApplicationAsync(CompanyId, AppId)).ReturnsAsync((OfferDetail)null!);

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.GetLetterPdfAsync(RawToken));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }
}
