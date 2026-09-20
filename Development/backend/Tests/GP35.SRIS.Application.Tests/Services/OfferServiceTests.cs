using GP35.SRIS.Application.Contracts.Dtos.Business.Offer;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services.Pdf;
using GP35.SRIS.Storage;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Serilog;
using Xunit;

namespace GP35.SRIS.Application.Tests.Services;

public class OfferServiceTests
{
    private readonly Mock<IApplicationRepo> _appRepo = new();
    private readonly Mock<IJobRepo> _jobRepo = new();
    private readonly Mock<IOfferRepo> _offerRepo = new();
    private readonly Mock<ICompanyRepo> _companyRepo = new();
    private readonly Mock<IUserRepo> _userRepo = new();
    private readonly Mock<IHiringProposalRepo> _proposalRepo = new();
    private readonly Mock<IApplicationStateService> _stateService = new();
    private readonly Mock<IMagicLinkService> _magicLink = new();
    private readonly Mock<INotificationService> _notification = new();
    private readonly Mock<IOfferLetterPdfGenerator> _pdf = new();
    private readonly Mock<IBrandLogoFetcher> _logo = new();
    private readonly Mock<IActivityLogRepo> _activityLogRepo = new();
    private readonly Mock<IOfferAttachmentRepo> _attachmentRepo = new();
    private readonly Mock<IFileStorageService> _fileStorage = new();
    private readonly Mock<IContextData> _contextData = new();
    private readonly Mock<ILogger> _logger = new();

    private OfferService CreateService()
    {
        _logger.Setup(l => l.ForContext<OfferService>()).Returns(_logger.Object);

        // GetBenefitsAsync không stub thì Moq trả null, mà GetLetterDefaultsAsync gọi
        // .Select() thẳng lên kết quả -> ArgumentNullException. Repo thật luôn trả list
        // (ToListAsync), nên mặc định của mock cũng phải là list rỗng chứ không phải null.
        _jobRepo.Setup(r => r.GetBenefitsAsync(It.IsAny<long>(), It.IsAny<long>()))
            .ReturnsAsync(new List<JobBenefit>());

        var provider = TestHost.Build(s =>
        {
            s.AddSingleton(_appRepo.Object);
            s.AddSingleton(_jobRepo.Object);
            s.AddSingleton(_offerRepo.Object);
            s.AddSingleton(_companyRepo.Object);
            s.AddSingleton(_userRepo.Object);
            s.AddSingleton(_proposalRepo.Object);
            s.AddSingleton(_stateService.Object);
            s.AddSingleton(_magicLink.Object);
            s.AddSingleton(_notification.Object);
            s.AddSingleton(_pdf.Object);
            s.AddSingleton(_logo.Object);
            s.AddSingleton(_activityLogRepo.Object);
            s.AddSingleton(_attachmentRepo.Object);
            s.AddSingleton(_fileStorage.Object);
            s.AddSingleton(_contextData.Object);
            s.AddSingleton(_logger.Object);
        });
        return new OfferService(provider);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Throw_Conflict_If_State_Not_Offer()
    {
        // Arrange
        var svc = CreateService();
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, CurrentState = "Interviewing" }; // Not Offer
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(app);

        var dto = new MakeOfferDto { SalaryAmount = 1000, Currency = "USD" };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.MakeOfferAsync(1L, 100L, 1L, dto));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task GetListAsync_Maps_Rows_With_And_Without_Offer()
    {
        // Danh sách xuyên vị trí: hồ sơ chờ soạn thư (chưa có OfferDetail) phải ra Offer = null,
        // không phải một thư rỗng — FE dựa vào đó để hiện nút "Soạn thư mời".
        var svc = CreateService();
        _offerRepo.Setup(r => r.GetListAsync(1L, null)).ReturnsAsync(new List<OfferListRow>
        {
            new(5, 7, "Kế toán tổng hợp", "Nguyễn Văn A", "a@example.com", "OFFER", null),
            new(6, 8, "Bếp chính", "Trần Thị B", "b@example.com", "HIRED",
                new OfferDetail { OfferId = 9, ApplicationId = 6, Status = "ACCEPTED", Currency = "VND", SalaryAmount = 15_000_000 })
        });

        var list = await svc.GetListAsync(1L, null);

        Assert.Equal(2, list.Count);
        Assert.Null(list[0].Offer);
        Assert.Equal("OFFER", list[0].ApplicationState);
        Assert.Equal("Kế toán tổng hợp", list[0].JobTitle);
        Assert.Equal("ACCEPTED", list[1].Offer!.Status);
        Assert.Equal(15_000_000, list[1].Offer!.SalaryAmount);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Throw_Conflict_If_Offer_Already_Exists()
    {
        // Arrange
        var svc = CreateService();
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, CurrentState = "Offer" };
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(app);

        var existingOffer = new OfferDetail { OfferId = 10 };
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 1L)).ReturnsAsync(existingOffer); // Offer exists

        var dto = new MakeOfferDto { SalaryAmount = 1000, Currency = "USD" };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.MakeOfferAsync(1L, 100L, 1L, dto));
        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Reject_StartDate_In_The_Past()
    {
        // Thư mời là văn bản chính thức, gửi đi rồi không sửa được -> chặn ngày vào làm
        // đã qua ngay ở bước soạn, không để lọt xuống DB.
        var svc = CreateService();
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(
            new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, JobId = 7, CurrentState = "Offer" });
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 1L)).ReturnsAsync((OfferDetail)null!);

        var dto = new MakeOfferDto
        {
            SalaryAmount = 1000,
            StartDate = DateTime.UtcNow.Date.AddDays(-1)
        };

        var ex = await Assert.ThrowsAsync<BaseException>(() => svc.MakeOfferAsync(1L, 100L, 1L, dto));
        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
        // Không được ghi gì xuống DB khi đã chặn.
        _offerRepo.Verify(r => r.InsertAsync(It.IsAny<long>(), It.IsAny<OfferDetail>()), Times.Never);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Accept_StartDate_Today()
    {
        // Ranh giới: nhận việc NGAY HÔM NAY là hợp lệ, chỉ quá khứ mới bị chặn.
        var svc = CreateService();
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(
            new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, JobId = 7, CurrentState = "Offer" });
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 1L)).ReturnsAsync((OfferDetail)null!);
        _offerRepo.Setup(r => r.InsertAsync(1L, It.IsAny<OfferDetail>())).ReturnsAsync(50L);
        _magicLink.Setup(m => m.IssueAsync(1L, 1L, "OFFER_RESPONSE", It.IsAny<TimeSpan>()))
            .ReturnsAsync(new MagicLinkIssued(1, "tok", "OFFER_RESPONSE", DateTime.UtcNow.AddDays(7)));

        var dto = new MakeOfferDto { SalaryAmount = 1000, StartDate = DateTime.UtcNow.Date };

        var result = await svc.MakeOfferAsync(1L, 100L, 1L, dto);
        Assert.NotNull(result);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Insert_Offer_And_Issue_MagicLink()
    {
        // Arrange
        var svc = CreateService();
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, JobId = 7, CurrentState = "Offer" };
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(app);
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 1L)).ReturnsAsync((OfferDetail)null!); // No existing offer

        _offerRepo.Setup(r => r.InsertAsync(1L, It.IsAny<OfferDetail>()))
            .Callback<long, OfferDetail>((c, o) => o.OfferId = 50)
            .ReturnsAsync(50L);

        _magicLink.Setup(m => m.IssueAsync(1L, 1L, "OFFER_RESPONSE", It.IsAny<TimeSpan>()))
            .ReturnsAsync(new MagicLinkIssued(1, "magic-token-123", "OFFER_RESPONSE", DateTime.UtcNow.AddDays(7)));

        // Ngày vào làm phải ở tương lai (MakeOfferAsync chặn ngày quá khứ) — dùng mốc tương
        // đối để test không tự hỏng khi thời gian trôi qua mốc cố định.
        var dto = new MakeOfferDto
        {
            SalaryAmount = 2000,
            Currency = "VND",
            StartDate = DateTime.UtcNow.Date.AddDays(30)
        };

        // Act
        var result = await svc.MakeOfferAsync(1L, 100L, 1L, dto);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("magic-token-123", result.MagicToken);
        Assert.Equal(50, result.Offer.OfferId);

        _offerRepo.Verify(r => r.InsertAsync(1L, It.Is<OfferDetail>(o => o.SalaryAmount == 2000 && o.Currency == "VND")), Times.Once);
        _activityLogRepo.Verify(r => r.InsertAsync(1L, It.Is<ActivityLog>(a => a.Action == "OFFER_LETTER_SENT")), Times.Once);
    }

    [Fact]
    public async Task MakeOfferAsync_Should_Fill_Blank_Fields_From_Job()
    {
        // Ô để trống -> lấy mặc định từ Job, KHÔNG để thư trống mục (5.15).
        var svc = CreateService();
        var app = new GP35.SRIS.Domain.Entities.Application { ApplicationId = 1, JobId = 7, CurrentState = "Offer" };
        _appRepo.Setup(r => r.GetByIdAsync(1L, 1L)).ReturnsAsync(app);
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 1L)).ReturnsAsync((OfferDetail)null!);
        _jobRepo.Setup(r => r.GetByIdAsync(1L, 7L)).ReturnsAsync(new Job
        {
            JobId = 7,
            Title = "Kế toán tổng hợp",
            Department = "Tài chính",
            EmploymentType = "Toàn thời gian",
            Location = "Hà Nội"
        });
        _offerRepo.Setup(r => r.InsertAsync(1L, It.IsAny<OfferDetail>())).ReturnsAsync(50L);
        _magicLink.Setup(m => m.IssueAsync(1L, 1L, "OFFER_RESPONSE", It.IsAny<TimeSpan>()))
            .ReturnsAsync(new MagicLinkIssued(1, "tok", "OFFER_RESPONSE", DateTime.UtcNow.AddDays(7)));

        // Chỉ nhập lương, mọi mục vị trí bỏ trống.
        var result = await svc.MakeOfferAsync(1L, 100L, 1L, new MakeOfferDto { SalaryAmount = 20_000_000 });

        Assert.Equal("Kế toán tổng hợp", result.Offer.JobTitle);
        Assert.Equal("Tài chính", result.Offer.Department);
        Assert.Equal("Toàn thời gian", result.Offer.EmploymentType);
        Assert.Equal("Hà Nội", result.Offer.WorkLocation);
        // Điều khoản mặc định của mẫu thư phải được điền sẵn, không để rỗng.
        Assert.False(string.IsNullOrWhiteSpace(result.Offer.Terms));
    }

    /// <summary>Hồ sơ đang ở OFFER — điều kiện chung của mọi test ghi nhận kết quả.</summary>
    private void SetupApplicationAtOffer(long appId = 100L) =>
        _appRepo.Setup(r => r.GetByIdAsync(1L, appId)).ReturnsAsync(
            new GP35.SRIS.Domain.Entities.Application { ApplicationId = appId, JobId = 7, CurrentState = "OFFER" });

    [Fact]
    public async Task RecordOutcomeAsync_Accepted_Should_Move_Application_To_Hired()
    {
        var svc = CreateService();
        SetupApplicationAtOffer();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "PENDING" });
        _offerRepo.Setup(r => r.SetOutcomeAsync(1L, 10L, "ACCEPTED", 9L, null, It.IsAny<DateTime>()))
            .ReturnsAsync(1);

        var result = await svc.RecordOutcomeAsync(1L, 9L, 100L, new OfferOutcomeDto { Accepted = true });

        Assert.Equal("ACCEPTED", result.OfferStatus);
        Assert.Equal("HIRED", result.ApplicationState);
        // isCandidateAnswer = true: ghi nhận câu trả lời, KHÔNG áp luật "chỉ DM của job" (5.14)
        // — job có gán DM mà bắt đúng DM mới ghi được thì Human Resource cầm email trả lời cũng chịu.
        _stateService.Verify(s => s.TransitionAsync(1L, 9L, 100L, "HIRED", null, true), Times.Once);
        _activityLogRepo.Verify(
            r => r.InsertAsync(1L, It.Is<ActivityLog>(a => a.Action == "OFFER_ACCEPTED")), Times.Once);
    }

    [Fact]
    public async Task RecordOutcomeAsync_Should_Not_Touch_Offer_If_Application_Left_Offer_State()
    {
        // Hồ sơ đã bị loại đường khác: phải chặn TRƯỚC khi ghi status offer, không thì offer
        // thành ACCEPTED trong khi hồ sơ đang REJECTED (hai bảng lệch nhau).
        var svc = CreateService();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "PENDING" });
        _appRepo.Setup(r => r.GetByIdAsync(1L, 100L)).ReturnsAsync(
            new GP35.SRIS.Domain.Entities.Application { ApplicationId = 100, JobId = 7, CurrentState = "REJECTED" });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.RecordOutcomeAsync(1L, 9L, 100L, new OfferOutcomeDto { Accepted = true }));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        _offerRepo.Verify(r => r.SetOutcomeAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(),
            It.IsAny<long?>(), It.IsAny<string>(), It.IsAny<DateTime>()), Times.Never);
    }

    [Fact]
    public async Task RecordOutcomeAsync_Declined_Should_Move_Application_To_Rejected_With_Note_As_Reason()
    {
        var svc = CreateService();
        SetupApplicationAtOffer();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "PENDING" });
        _offerRepo.Setup(r => r.SetOutcomeAsync(1L, 10L, "DECLINED", 9L, "Nhận offer công ty khác", It.IsAny<DateTime>()))
            .ReturnsAsync(1);

        var result = await svc.RecordOutcomeAsync(
            1L, 9L, 100L, new OfferOutcomeDto { Accepted = false, Note = "Nhận offer công ty khác" });

        Assert.Equal("DECLINED", result.OfferStatus);
        Assert.Equal("REJECTED", result.ApplicationState);
        _stateService.Verify(
            s => s.TransitionAsync(1L, 9L, 100L, "REJECTED", "Nhận offer công ty khác", true), Times.Once);
    }

    [Fact]
    public async Task RecordOutcomeAsync_Should_Throw_Conflict_If_Already_Recorded()
    {
        var svc = CreateService();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "ACCEPTED" });

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.RecordOutcomeAsync(1L, 9L, 100L, new OfferOutcomeDto { Accepted = true }));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        _stateService.Verify(
            s => s.TransitionAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
    }

    [Fact]
    public async Task RecordOutcomeAsync_Should_Not_Transition_When_Optimistic_Lock_Loses()
    {
        // Hai người bấm cùng lúc: rowcount=0 -> KHÔNG được đẩy state lần hai.
        var svc = CreateService();
        SetupApplicationAtOffer();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, Status = "PENDING" });
        _offerRepo.Setup(r => r.SetOutcomeAsync(
                It.IsAny<long>(), It.IsAny<long>(), It.IsAny<string>(),
                It.IsAny<long?>(), It.IsAny<string>(), It.IsAny<DateTime>()))
            .ReturnsAsync(0);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.RecordOutcomeAsync(1L, 9L, 100L, new OfferOutcomeDto { Accepted = true }));

        Assert.Equal("CONFLICT", ex.ErrorCode);
        _stateService.Verify(
            s => s.TransitionAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
    }

    // ============================================================
    // Bản scan hợp đồng đã ký (V058)
    // ============================================================

    private void SetupOfferSent() =>
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L))
            .ReturnsAsync(new OfferDetail { OfferId = 10, ApplicationId = 100, Status = "PENDING" });

    [Fact]
    public async Task AddAttachmentAsync_Should_Throw_Conflict_If_No_Offer()
    {
        // File đính vào THƯ MỜI — chưa gửi thư thì không có gì để đính vào.
        var svc = CreateService();
        _offerRepo.Setup(r => r.GetByApplicationAsync(1L, 100L)).ReturnsAsync((OfferDetail?)null);

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.AddAttachmentAsync(1L, 9L, 100L, "hop-dong.pdf", "application/pdf",
                new byte[] { 1, 2, 3 }, null, null));

        Assert.Equal("CONFLICT", ex.ErrorCode);
    }

    [Fact]
    public async Task AddAttachmentAsync_Should_Reject_Unsupported_Extension()
    {
        // Danh sách trắng theo ĐUÔI FILE, không tin Content-Type client khai.
        var svc = CreateService();
        SetupOfferSent();

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.AddAttachmentAsync(1L, 9L, 100L, "hop-dong.exe", "application/pdf",
                new byte[] { 1, 2, 3 }, null, null));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
        _fileStorage.Verify(f => f.UploadAsync(It.IsAny<string>(), It.IsAny<Stream>(),
            It.IsAny<long>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AddAttachmentAsync_Should_Reject_Oversize_File()
    {
        var svc = CreateService();
        SetupOfferSent();

        var ex = await Assert.ThrowsAsync<BaseException>(
            () => svc.AddAttachmentAsync(1L, 9L, 100L, "scan.pdf", "application/pdf",
                new byte[10 * 1024 * 1024 + 1], null, null));

        Assert.Equal("BAD_REQUEST", ex.ErrorCode);
    }

    [Fact]
    public async Task AddAttachmentAsync_Should_Store_File_And_Leave_Application_State_Alone()
    {
        // Lưu bằng chứng giấy tờ KHÔNG phải một quyết định: không đường nào được đụng current_state.
        var svc = CreateService();
        SetupOfferSent();
        _attachmentRepo.Setup(r => r.InsertAsync(1L, It.IsAny<OfferAttachment>())).ReturnsAsync(55L);
        _fileStorage.Setup(f => f.UploadAsync(It.IsAny<string>(), It.IsAny<Stream>(),
                It.IsAny<long>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string name, Stream _, long size, string ct, CancellationToken _) =>
                new StoredFileInfo(name, size, ct));
        _fileStorage.Setup(f => f.GetPresignedUrlAsync(It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://minio/scan.pdf");

        var dto = await svc.AddAttachmentAsync(1L, 9L, 100L, @"C:\tam\hop dong.PDF", "application/pdf",
            new byte[] { 1, 2, 3 }, "  bản ký 21/09  ", null);

        Assert.Equal(55L, dto.AttachmentId);
        Assert.Equal("SIGNED_CONTRACT", dto.Kind);
        Assert.Equal("hop dong.PDF", dto.FileName);   // đường dẫn của client bị bóc đi
        Assert.Equal("bản ký 21/09", dto.Note);
        Assert.Equal("https://minio/scan.pdf", dto.FileUrl);

        _attachmentRepo.Verify(r => r.InsertAsync(1L, It.Is<OfferAttachment>(
            a => a.OfferId == 10 && a.ApplicationId == 100
                 && a.FileUrl.StartsWith("offer-signed/1/100/")
                 && a.MimeType == "application/pdf")), Times.Once);
        _stateService.Verify(
            s => s.TransitionAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<long>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>()), Times.Never);
    }

    [Fact]
    public async Task AddAttachmentAsync_Should_Not_Insert_Row_When_Storage_Fails()
    {
        // Ghi một dòng trỏ vào object không tồn tại = dựng sẵn bằng chứng giả.
        var svc = CreateService();
        SetupOfferSent();
        _fileStorage.Setup(f => f.UploadAsync(It.IsAny<string>(), It.IsAny<Stream>(),
                It.IsAny<long>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new IOException("minio down"));

        await Assert.ThrowsAsync<IOException>(
            () => svc.AddAttachmentAsync(1L, 9L, 100L, "scan.pdf", "application/pdf",
                new byte[] { 1 }, null, null));

        _attachmentRepo.Verify(r => r.InsertAsync(It.IsAny<long>(), It.IsAny<OfferAttachment>()), Times.Never);
    }

    [Fact]
    public async Task GetAttachmentsAsync_Should_Keep_Row_When_Presigned_Url_Fails()
    {
        // Storage lỗi thì dòng vẫn hiện (người dùng biết CÓ bản scan), chỉ thiếu link.
        var svc = CreateService();
        _attachmentRepo.Setup(r => r.GetByApplicationAsync(1L, 100L)).ReturnsAsync(new List<OfferAttachment>
        {
            new() { AttachmentId = 7, ApplicationId = 100, FileName = "scan.pdf",
                    FileUrl = "offer-signed/1/100/x.pdf", Kind = "SIGNED_CONTRACT" }
        });
        _fileStorage.Setup(f => f.GetPresignedUrlAsync(It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new IOException("minio down"));

        var list = await svc.GetAttachmentsAsync(1L, 100L);

        var only = Assert.Single(list);
        Assert.Equal("scan.pdf", only.FileName);
        Assert.Null(only.FileUrl);
    }

    [Fact]
    public async Task DeleteAttachmentAsync_Should_Refuse_Row_Of_Another_Application()
    {
        // attachment_id đoán được, nên phải khớp CẢ hồ sơ đang mở.
        var svc = CreateService();
        _attachmentRepo.Setup(r => r.GetByIdAsync(1L, 7L))
            .ReturnsAsync(new OfferAttachment { AttachmentId = 7, ApplicationId = 999, FileName = "x.pdf" });

        Assert.False(await svc.DeleteAttachmentAsync(1L, 100L, 7L));
        _attachmentRepo.Verify(r => r.DeleteAsync(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
    }
}
