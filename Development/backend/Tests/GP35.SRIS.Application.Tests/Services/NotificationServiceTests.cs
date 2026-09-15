using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Lib.Services;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

/// <summary>
/// Email onboarding (15/09/2026): trúng tuyển là ứng viên nhận CẢ thư chúc mừng lẫn thư
/// onboarding. Trước đây công ty chưa bật mẫu ONBOARDING thì thư onboarding im lặng bị bỏ qua.
/// </summary>
public class NotificationServiceTests
{
    private const long CompanyId = 1;
    private const long AppId = 99;

    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<IEmailTemplateRepo> _templateRepo = new();
    private readonly Mock<ICompanyRepo> _companyRepo = new();
    private readonly Mock<IOfferRepo> _offerRepo = new();
    private readonly Mock<IEmailService> _email = new();

    private string? _sentSubject;
    private string? _sentBody;
    private string? _sentTo;

    private NotificationService CreateService()
    {
        _appRepo.Setup(r => r.GetContactInfoAsync(CompanyId, AppId))
            .ReturnsAsync(new ApplicationContactInfo(
                AppId, "phuong@example.com", "Hoàng Mai Phương", "Nhân viên Kinh doanh B2B", "HIRED"));
        _companyRepo.Setup(r => r.GetByCompanyId(CompanyId))
            .ReturnsAsync(new Company
            {
                CompanyId = CompanyId, Name = "Công ty ABC",
                Address = "12 Láng Hạ, Hà Nội", ContactEmail = "hr@abc.vn"
            });
        _offerRepo.Setup(r => r.GetByApplicationAsync(CompanyId, AppId))
            .ReturnsAsync(new OfferDetail
            {
                ApplicationId = AppId, JobTitle = "Nhân viên Kinh doanh B2B",
                StartDate = new DateTime(2026, 10, 1), HrContactEmail = "tuyendung@abc.vn"
            });
        _email.Setup(e => e.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
            .Callback<string, string, string, string>((s, b, to, _) =>
            {
                _sentSubject = s;
                _sentBody = b;
                _sentTo = to;
            })
            .ReturnsAsync("ok");

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_templateRepo.Object);
            s.AddSingleton(_companyRepo.Object);
            s.AddSingleton(_offerRepo.Object);
            s.AddSingleton(_email.Object);
        });
        return new NotificationService(provider);
    }

    [Fact]
    public async Task SendOnboarding_WithoutActiveTemplate_SendsBuiltInDefault()
    {
        var service = CreateService();
        _templateRepo.Setup(r => r.GetActiveByTypeAsync(CompanyId, EmailTemplateType.Onboarding))
            .ReturnsAsync((EmailTemplate?)null);

        await service.SendOnboardingAsync(CompanyId, AppId);

        Assert.Equal("phuong@example.com", _sentTo);
        Assert.Equal("Chào mừng Hoàng Mai Phương gia nhập Công ty ABC!", _sentSubject);
        // Ngày vào làm lấy từ thư mời, địa chỉ + email nhân sự lấy từ dữ liệu có sẵn.
        Assert.Contains("01/10/2026", _sentBody);
        Assert.Contains("12 Láng Hạ, Hà Nội", _sentBody);
        Assert.Contains("tuyendung@abc.vn", _sentBody);
        // Bản mặc định phải gửi được ngay: không còn ô {{...}} chưa thay, không còn "[điền tay]".
        // Trừ đúng hai dấu ngoặc của comment điều kiện Outlook trong vỏ EmailLayout
        // ("<!--[if mso]>" / "<![endif]-->") — đó là HTML khung, không phải chỗ trống.
        Assert.DoesNotContain("{{", _sentBody);
        Assert.DoesNotMatch(@"\[(?!if mso\]|endif\])", _sentBody);
    }

    [Fact]
    public async Task SendOnboarding_WithActiveTemplate_UsesCompanyTemplate()
    {
        var service = CreateService();
        _templateRepo.Setup(r => r.GetActiveByTypeAsync(CompanyId, EmailTemplateType.Onboarding))
            .ReturnsAsync(new EmailTemplate
            {
                Type = EmailTemplateType.Onboarding, IsActive = true,
                Subject = "Welcome {{candidateName}}",
                Body = "<p>Gửi xe ở hầm B2, có mặt lúc 8h30 ngày {{startDate}}.</p>"
            });

        await service.SendOnboardingAsync(CompanyId, AppId);

        Assert.Equal("Welcome Hoàng Mai Phương", _sentSubject);
        Assert.Contains("hầm B2", _sentBody);
        Assert.Contains("01/10/2026", _sentBody);
    }
}
