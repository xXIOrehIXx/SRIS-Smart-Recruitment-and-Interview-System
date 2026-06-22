using GP35.SRIS.Application.Contracts.Dtos.Business.Pipeline;

namespace GP35.SRIS.Application.Contracts.Services.Business;

/// <summary>Đọc lịch sử hồ sơ (audit "ai làm gì lúc nào" — docs 5.6). Ghi log nằm rải ở các service nghiệp vụ.</summary>
public interface IActivityLogService : IBaseService
{
    /// <summary>Timeline hoạt động của 1 hồ sơ (theo thứ tự thời gian).</summary>
    Task<IReadOnlyList<ActivityLogDto>> GetHistoryAsync(long companyId, long applicationId);
}
