using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Repos;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>Đọc lịch sử hồ sơ (audit). Chỉ đọc — việc ghi log nằm ở các service nghiệp vụ (transition, offer...).</summary>
public class ActivityLogService : BaseService<ActivityLogService>, IActivityLogService
{
    private readonly IActivityLogRepo _logRepo;

    public ActivityLogService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _logRepo = serviceProvider.GetRequiredService<IActivityLogRepo>();
    }

    public async Task<IReadOnlyList<ActivityLogDto>> GetHistoryAsync(long companyId, long applicationId)
    {
        var rows = await _logRepo.GetByApplicationAsync(companyId, applicationId);
        return rows.Select(r => new ActivityLogDto
        {
            LogId = r.LogId,
            ActorId = r.UserId,
            ActorEmail = r.ActorEmail,
            Action = r.Action,
            FromState = r.FromState,
            ToState = r.ToState,
            Detail = r.Detail,
            CreatedAt = r.CreatedAt
        }).ToList();
    }
}
