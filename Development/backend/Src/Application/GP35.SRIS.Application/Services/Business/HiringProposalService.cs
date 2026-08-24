using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
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
/// Đề xuất tuyển (docs 5.14 — chốt 15/08/2026 sau bảo vệ hội đồng).
///
/// Trưởng bộ phận KHÔNG đủ thẩm quyền tuyển: họ đọc kết luận hội đồng phỏng vấn rồi ĐỀ XUẤT;
/// GIÁM ĐỐC quyết và chốt điều khoản (lương, ngày vào làm). Duyệt đề xuất chính là hành động
/// đẩy hồ sơ INTERVIEW→OFFER — hai việc đi cùng nhau nên không có cảnh "đã duyệt mà card
/// vẫn nằm ở cột Phỏng vấn".
/// </summary>
public class HiringProposalService : BaseService<HiringProposalService>, IHiringProposalService
{
    private const string StatusPending = "PENDING";
    private const string StatusApproved = "APPROVED";
    private const string StatusRejected = "REJECTED";

    private readonly IHiringProposalRepo _proposalRepo;
    private readonly IApplicationRepo _appRepo;
    private readonly IJobRepo _jobRepo;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly IApplicationStateService _stateService;
    private readonly IContextData _contextData;
    private readonly ILogger _logger;

    public HiringProposalService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _proposalRepo = serviceProvider.GetRequiredService<IHiringProposalRepo>();
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _stateService = serviceProvider.GetRequiredService<IApplicationStateService>();
        _contextData = serviceProvider.GetRequiredService<IContextData>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<HiringProposalService>();
    }

    public async Task<HiringProposalDto> CreateAsync(
        long companyId, long userId, long applicationId, CreateProposalDto dto)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        if (!string.Equals(app.CurrentState, ApplicationState.Interview, StringComparison.OrdinalIgnoreCase))
            throw Conflict(string.Equals(app.CurrentState, ApplicationState.Offer, StringComparison.OrdinalIgnoreCase)
                ? "Hồ sơ này đã sang bước Quyết định rồi — không cần đề xuất nữa."
                : "Chỉ đề xuất tuyển cho hồ sơ đang ở bước Phỏng vấn.");

        await EnsureIsJobManagerAsync(companyId, userId, app.JobId);

        // Cùng ngưỡng với guard G2 của INTERVIEW→OFFER: đề xuất mà chưa ai chấm thì Giám đốc
        // duyệt xong sẽ vấp guard ngay lúc chuyển trạng thái — chặn từ đây cho đúng chỗ.
        var submitted = await _appRepo.CountSubmittedInterviewScoresAsync(companyId, applicationId);
        if (submitted < 1)
            throw Conflict("Chưa có phiếu chấm phỏng vấn nào được nộp — chưa có căn cứ để đề xuất tuyển.");

        if (await _proposalRepo.GetPendingByApplicationAsync(companyId, applicationId) is not null)
            throw Conflict("Hồ sơ này đã có một đề xuất đang chờ Giám đốc duyệt.");

        var proposal = new HiringProposal
        {
            ApplicationId = applicationId,
            Status = StatusPending,
            ProposalNote = Normalize(dto.Note),
            ProposedSalary = dto.ProposedSalary,
            CreatedBy = userId > 0 ? userId : null
        };
        var proposalId = await _proposalRepo.InsertAsync(companyId, proposal);

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "HIRING_PROPOSED",
            Detail = proposal.ProposalNote
        });

        _logger.Information("Đề xuất tuyển {ProposalId} cho hồ sơ {AppId} (người đề xuất={UserId}).",
            proposalId, applicationId, userId);

        return await GetOneAsync(companyId, proposalId);
    }

    public async Task<HiringProposalDto> DecideAsync(
        long companyId, long userId, long proposalId, DecideProposalDto dto)
    {
        var proposal = await _proposalRepo.GetByIdAsync(companyId, proposalId)
            ?? throw NotFound($"Không tìm thấy đề xuất (proposal_id={proposalId}).");

        if (!string.Equals(proposal.Status, StatusPending, StringComparison.OrdinalIgnoreCase))
            throw Conflict($"Đề xuất này đã được xử lý ({proposal.Status}).");

        var note = Normalize(dto.Note);
        var now = DateTime.UtcNow;

        if (dto.Approve)
        {
            // Chuyển trạng thái TRƯỚC khi đóng phiếu: guard G2 hoặc luật quyền có chặn thì
            // phiếu vẫn còn PENDING để Giám đốc bấm lại, thay vì phiếu ghi APPROVED mà hồ sơ
            // đứng yên ở cột Phỏng vấn.
            await _stateService.TransitionAsync(
                companyId, userId, proposal.ApplicationId, ApplicationState.Offer, note);

            proposal.Status = StatusApproved;
            // Bỏ trống = giữ nguyên mức DM đề xuất (Giám đốc gật đầu chứ không mặc cả lại).
            proposal.ApprovedSalary = dto.ApprovedSalary ?? proposal.ProposedSalary;
        }
        else
        {
            // Không duyệt KHÁC loại ứng viên: hồ sơ ở lại bước Phỏng vấn, Trưởng bộ phận bổ sung
            // căn cứ rồi đề xuất lại được (UX_HiringProp_pending chỉ chặn phiếu ĐANG CHỜ).
            proposal.Status = StatusRejected;
        }

        proposal.DecisionNote = note;
        proposal.DecidedBy = userId > 0 ? userId : null;
        proposal.DecidedAt = now;
        await _proposalRepo.SaveAsync();

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = proposal.ApplicationId,
            UserId = userId > 0 ? userId : null,
            Action = dto.Approve ? "HIRING_APPROVED" : "HIRING_PROPOSAL_REJECTED",
            Detail = note
        });

        _logger.Information("Giám đốc {UserId} {Decision} đề xuất {ProposalId} (hồ sơ {AppId}).",
            userId, dto.Approve ? "duyệt" : "từ chối", proposalId, proposal.ApplicationId);

        return await GetOneAsync(companyId, proposalId);
    }

    public async Task<IReadOnlyList<HiringProposalDto>> GetListAsync(long companyId, string? status)
    {
        var rows = await _proposalRepo.GetListAsync(companyId, Normalize(status)?.ToUpperInvariant());
        return rows.Select(ToDto).ToList();
    }

    public async Task<IReadOnlyList<HiringProposalDto>> GetByApplicationAsync(long companyId, long applicationId)
    {
        var rows = await _proposalRepo.GetListAsync(companyId, null);
        return rows.Where(r => r.Proposal.ApplicationId == applicationId).Select(ToDto).ToList();
    }

    // ============================================================

    private async Task<HiringProposalDto> GetOneAsync(long companyId, long proposalId)
    {
        var rows = await _proposalRepo.GetListAsync(companyId, null);
        var row = rows.FirstOrDefault(r => r.Proposal.ProposalId == proposalId)
            ?? throw NotFound($"Không tìm thấy đề xuất (proposal_id={proposalId}).");
        return ToDto(row);
    }

    /// <summary>
    /// Đề xuất là tiếng nói chuyên môn của người phụ trách vị trí — người khác đề xuất hộ thì
    /// Giám đốc đang đọc ý kiến của ai không rõ. Admin là superuser -> bỏ qua.
    /// </summary>
    private async Task EnsureIsJobManagerAsync(long companyId, long userId, long jobId)
    {
        if (userId <= 0) return;
        if (string.Equals(_contextData.Role, RoleConstants.Admin, StringComparison.OrdinalIgnoreCase)) return;

        var job = await _jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy vị trí (job) của hồ sơ (job_id={jobId}).");

        if (job.DepartmentManagerId is not long dmId)
            throw Forbidden("Vị trí này chưa gán Trưởng bộ phận phụ trách nên chưa ai đề xuất tuyển được.");
        if (dmId != userId)
            throw Forbidden("Chỉ Trưởng bộ phận phụ trách vị trí này mới được đề xuất tuyển ứng viên.");
    }

    private static HiringProposalDto ToDto(HiringProposalRow row) => new()
    {
        ProposalId = row.Proposal.ProposalId,
        ApplicationId = row.Proposal.ApplicationId,
        Status = row.Proposal.Status,

        ProposalNote = row.Proposal.ProposalNote,
        ProposedSalary = row.Proposal.ProposedSalary,
        CreatedBy = row.Proposal.CreatedBy,
        CreatedByName = row.CreatedByName,
        CreatedAt = row.Proposal.CreatedAt,

        DecisionNote = row.Proposal.DecisionNote,
        ApprovedSalary = row.Proposal.ApprovedSalary,
        DecidedBy = row.Proposal.DecidedBy,
        DecidedByName = row.DecidedByName,
        DecidedAt = row.Proposal.DecidedAt,

        CandidateName = row.CandidateName,
        CandidateEmail = row.CandidateEmail,
        JobId = row.JobId,
        JobTitle = row.JobTitle,
        Department = row.Department,
        ApplicationState = row.ApplicationState
    };

    private static string? Normalize(string? text)
    {
        var trimmed = text?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException NotFound(string msg) => new(msg)
    {
        ErrorCode = "NOT_FOUND", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.NotFound
    };

    private static BaseException Forbidden(string msg) => new(msg)
    {
        ErrorCode = "FORBIDDEN", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Forbidden
    };

    private static BaseException Conflict(string msg) => new(msg)
    {
        ErrorCode = "CONFLICT", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Conflict
    };
}
