using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Candidate.Status;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Application.Contracts.Services.CandidatePortal;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services.CandidatePortal;

/// <summary>
/// Ứng viên tự xem trạng thái hồ sơ qua magic link STATUS (docs 5.13). CHỈ ĐỌC — không đốt token.
/// Chỉ trả thông tin an toàn (bước + thông điệp lịch sự), KHÔNG lộ reject_reason/điểm/ghi chú.
/// </summary>
public class CandidateStatusService : BaseService<CandidateStatusService>, ICandidateStatusService
{
    private const string Purpose = "STATUS";

    private readonly IMagicLinkService _magicLink;
    private readonly IApplicationRepo _appRepo;

    public CandidateStatusService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _magicLink = serviceProvider.GetRequiredService<IMagicLinkService>();
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
    }

    public async Task<CandidateStatusDto> GetStatusAsync(string rawToken)
    {
        // Xác thực token STATUS; KHÔNG MarkUsed (link xem lại được nhiều lần trong TTL).
        var v = await _magicLink.ValidateAsync(rawToken, Purpose);

        var info = await _appRepo.GetContactInfoAsync(v.CompanyId, v.ApplicationId)
            ?? throw NotFound("Không tìm thấy hồ sơ.");
        var app = await _appRepo.GetByIdAsync(v.CompanyId, v.ApplicationId);

        var state = (info.CurrentState ?? "").Trim().ToUpperInvariant();
        var isHired = state == ApplicationState.Hired;
        var isRejected = state == ApplicationState.Rejected;

        return new CandidateStatusDto
        {
            CandidateName = info.CandidateName,
            JobTitle = info.JobTitle,
            CurrentStage = state,
            StageLabel = StageLabel(state),
            StatusMessage = StatusMessage(state),
            IsClosed = isHired || isRejected,
            IsHired = isHired,
            UpdatedAt = app?.StageUpdatedAt
        };
    }

    // ============================================================

    private static string StageLabel(string state) => state switch
    {
        ApplicationState.New => "Hồ sơ đã tiếp nhận",
        ApplicationState.Screening => "Đang sàng lọc hồ sơ",
        ApplicationState.Quiz => "Vòng kiểm tra trực tuyến",
        ApplicationState.Interview => "Vòng phỏng vấn",
        ApplicationState.Offer => "Đề nghị tuyển dụng",
        ApplicationState.Hired => "Trúng tuyển",
        ApplicationState.Rejected => "Đã kết thúc",
        _ => "Đang xử lý"
    };

    private static string StatusMessage(string state) => state switch
    {
        ApplicationState.New =>
            "Chúng tôi đã nhận hồ sơ của bạn và sẽ xem xét trong thời gian sớm nhất.",
        ApplicationState.Screening =>
            "Hồ sơ của bạn đang được bộ phận tuyển dụng sàng lọc.",
        ApplicationState.Quiz =>
            "Bạn đang ở vòng làm bài kiểm tra trực tuyến. Vui lòng kiểm tra email để biết hướng dẫn.",
        ApplicationState.Interview =>
            "Bạn đang ở vòng phỏng vấn. Vui lòng kiểm tra email để chọn/xác nhận lịch.",
        ApplicationState.Offer =>
            "Chúc mừng! Bạn đã nhận được đề nghị tuyển dụng. Vui lòng kiểm tra email để phản hồi.",
        ApplicationState.Hired =>
            "Chúc mừng bạn đã trúng tuyển! Bộ phận tuyển dụng sẽ liên hệ về các bước tiếp theo.",
        ApplicationState.Rejected =>
            "Cảm ơn bạn đã quan tâm đến vị trí này. Rất tiếc hồ sơ của bạn chưa phù hợp lần này. " +
            "Chúng tôi sẽ lưu hồ sơ và liên hệ khi có cơ hội phù hợp hơn.",
        _ => "Hồ sơ của bạn đang được xử lý."
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };
}
