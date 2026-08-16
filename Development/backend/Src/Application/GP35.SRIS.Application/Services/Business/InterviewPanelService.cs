using System.Net;
using GP35.SRIS.Application.Contracts.Dtos.Business.Interview;
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
/// Trưởng bộ phận chỉ định người phỏng vấn cho từng ứng viên (V045 — chốt 16/08/2026).
///
/// Vì sao tách khỏi <see cref="InterviewScheduleService"/>: đặt lịch là việc VẬN HÀNH của bộ
/// phận nhân sự (giờ giấc, chống trùng, email), còn chọn ai gặp ứng viên là quyết định CHUYÊN
/// MÔN của Trưởng bộ phận — cùng một mạch với việc họ duyệt ứng viên vào vòng phỏng vấn. Gộp
/// hai thứ vào một service là mời người sau sửa nhầm cửa.
///
/// Ranh giới phải giữ: service này KHÔNG đụng <c>current_state</c>. Chỉ định người phỏng vấn
/// không đẩy hồ sơ đi đâu cả; đường duyệt vào vòng phỏng vấn nằm ở
/// <see cref="ApplicationStateService"/> và nó gọi sang đây, không phải ngược lại.
/// </summary>
public class InterviewPanelService : BaseService<InterviewPanelService>, IInterviewPanelService
{
    private readonly IApplicationRepo _appRepo;
    private readonly IJobRepo _jobRepo;
    private readonly ISchedulingRepo _schedulingRepo;
    private readonly IUserRepo _userRepo;
    private readonly IActivityLogRepo _activityLogRepo;
    private readonly IContextData _contextData;
    private readonly ILogger _logger;

    public InterviewPanelService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _appRepo = serviceProvider.GetRequiredService<IApplicationRepo>();
        _jobRepo = serviceProvider.GetRequiredService<IJobRepo>();
        _schedulingRepo = serviceProvider.GetRequiredService<ISchedulingRepo>();
        _userRepo = serviceProvider.GetRequiredService<IUserRepo>();
        _activityLogRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
        _contextData = serviceProvider.GetRequiredService<IContextData>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<InterviewPanelService>();
    }

    public async Task<IReadOnlyList<InterviewerMiniDto>> GetAsync(long companyId, long applicationId)
    {
        _ = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        var ids = await _schedulingRepo.GetAssignedInterviewersAsync(companyId, applicationId);
        if (ids.Count == 0) return Array.Empty<InterviewerMiniDto>();

        var users = (await _userRepo.GetNamesByIdsAsync(companyId, ids))
            .ToDictionary(u => u.UserId, u => u);

        return ids.Select(id => new InterviewerMiniDto
        {
            InterviewerId = id,
            FullName = users.TryGetValue(id, out var u) ? (u.FullName ?? u.Email ?? $"#{id}") : $"#{id}",
            Email = users.TryGetValue(id, out var u2) ? u2.Email : null
        }).ToList();
    }

    public async Task AssignAsync(
        long companyId, long userId, long applicationId, IReadOnlyList<long> interviewerIds,
        bool alreadyAuthorized = false)
    {
        var app = await _appRepo.GetByIdAsync(companyId, applicationId)
            ?? throw NotFound($"Không tìm thấy hồ sơ (application_id={applicationId}).");

        if (!alreadyAuthorized)
            await EnsureIsJobManagerAsync(companyId, userId, app.JobId);

        await ValidateAsync(companyId, interviewerIds);

        var ids = interviewerIds.Distinct().ToList();
        await _schedulingRepo.ReplaceAssignedInterviewersAsync(
            companyId, applicationId, ids, userId > 0 ? userId : null);

        await _activityLogRepo.InsertAsync(companyId, new ActivityLog
        {
            ApplicationId = applicationId,
            UserId = userId > 0 ? userId : null,
            Action = "INTERVIEWERS_ASSIGNED",
            Detail = ids.Count == 0
                ? "Gỡ toàn bộ chỉ định người phỏng vấn."
                : $"Chỉ định {ids.Count} người phỏng vấn."
        });

        _logger.Information("Panel: hồ sơ {AppId} được chỉ định {Count} người phỏng vấn (user={UserId}).",
            applicationId, ids.Count, userId);
    }

    public async Task ValidateAsync(long companyId, IReadOnlyList<long> interviewerIds)
    {
        // Danh sách RỖNG hợp lệ ở đây = gỡ chỉ định. Việc "phải có ít nhất 1 người mới đặt được
        // lịch" là luật của bước đặt lịch (InterviewScheduleService), không phải của bước này —
        // DM có quyền gỡ nhầm người rồi chỉ định lại.
        if (interviewerIds.Count == 0) return;

        if (interviewerIds.Count > InterviewPanel.MaxSize)
            throw Bad($"Tối đa {InterviewPanel.MaxSize} người phỏng vấn cho một ứng viên.");
        if (interviewerIds.Distinct().Count() != interviewerIds.Count)
            throw Bad("Danh sách người phỏng vấn bị trùng.");

        var ids = interviewerIds.Distinct().ToList();
        var users = await _userRepo.GetNamesByIdsAsync(companyId, ids);

        // Query filter đã lọc theo company -> id không trả về nghĩa là không có thật HOẶC thuộc
        // công ty khác. Hai trường hợp nói cùng một câu: không dùng được.
        var missing = ids.Where(id => users.All(u => u.UserId != id)).ToList();
        if (missing.Count > 0)
            throw Bad($"Không tìm thấy tài khoản người phỏng vấn (user_id={string.Join(", ", missing)}).");

        var inactive = users.Where(u => !string.Equals(u.Status, "Active", StringComparison.OrdinalIgnoreCase)).ToList();
        if (inactive.Count > 0)
            throw Bad($"{string.Join(", ", inactive.Select(u => u.FullName ?? u.Email))} " +
                      "đã ngừng hoạt động — không chỉ định phỏng vấn được.");

        // KHÔNG ép role = Interviewer: công ty nhỏ chạy bằng đúng một tài khoản Admin, và
        // /users/options cũng rơi về Admin khi công ty chưa có Interviewer nào. Ép role ở đây
        // là làm dropdown trả về thứ chính BE từ chối nhận.
    }

    // ============================================================

    /// <summary>
    /// Chỉ Trưởng bộ phận phụ trách vị trí mới chỉ định được người phỏng vấn cho hồ sơ của vị trí
    /// đó — cùng một luật với cửa SCREENING→INTERVIEW (<c>ApplicationStateService</c>), vì đây là
    /// nửa còn lại của cùng một quyết định. Admin bypass (công ty nhỏ 1 tài khoản).
    /// </summary>
    private async Task EnsureIsJobManagerAsync(long companyId, long userId, long jobId)
    {
        if (string.Equals(_contextData.Role, RoleConstants.Admin, StringComparison.OrdinalIgnoreCase))
            return;

        var job = await _jobRepo.GetByIdAsync(companyId, jobId)
            ?? throw NotFound($"Không tìm thấy vị trí (job) của hồ sơ (job_id={jobId}).");

        if (job.DepartmentManagerId is not long dmId)
            throw Forbidden(
                "Vị trí này chưa gán Trưởng bộ phận phụ trách nên chưa ai chỉ định được người " +
                "phỏng vấn. Hãy gán người phụ trách cho tin tuyển dụng trước.");

        if (dmId != userId)
            throw Forbidden("Chỉ Trưởng bộ phận phụ trách vị trí này mới được chỉ định người phỏng vấn.");
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
}
