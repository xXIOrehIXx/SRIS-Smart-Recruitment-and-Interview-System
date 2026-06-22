using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Nhật ký hoạt động (append-only) — audit "ai làm gì lúc nào" (docs 5.6).</summary>
public interface IActivityLogRepo : IBaseRepo<long, ActivityLog>
{
    /// <summary>Ghi 1 dòng log.</summary>
    Task InsertAsync(long companyId, ActivityLog log);
}
