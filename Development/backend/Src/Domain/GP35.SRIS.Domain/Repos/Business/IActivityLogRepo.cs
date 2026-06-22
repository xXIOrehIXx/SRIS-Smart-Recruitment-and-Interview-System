using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>1 dòng nhật ký kèm email người thực hiện (join User; null nếu do hệ thống/ứng viên).</summary>
public record ActivityLogRow(
    long LogId, long? UserId, string? ActorEmail, string Action,
    string? FromState, string? ToState, string? Detail, DateTime? CreatedAt);

/// <summary>Nhật ký hoạt động (append-only) — audit "ai làm gì lúc nào" (docs 5.6).</summary>
public interface IActivityLogRepo : IBaseRepo<long, ActivityLog>
{
    /// <summary>Ghi 1 dòng log.</summary>
    Task InsertAsync(long companyId, ActivityLog log);

    /// <summary>Lịch sử hoạt động của 1 hồ sơ (theo thứ tự thời gian), kèm email người thực hiện.</summary>
    Task<IReadOnlyList<ActivityLogRow>> GetByApplicationAsync(long companyId, long applicationId);
}
