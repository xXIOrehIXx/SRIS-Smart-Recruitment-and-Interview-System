using GP35.SRIS.Domain;

namespace GP35.SRIS.Domain.SqlServer;

/// <summary>
/// Lớp cơ sở tối giản cho các repository EF Core. Không còn chứa truy cập dữ liệu —
/// mỗi repo resolve <c>SrisDbContext</c> và viết truy vấn LINQ/raw SQL riêng.
/// (Đã gỡ Dapper + IConnectionManager — tầng dữ liệu thuần EF Core, quyết định 5.11.)
/// </summary>
public abstract class BaseRepo<TKey, T> : IBaseRepo<TKey, T> where T : BaseEntity<TKey>
{
    protected BaseRepo(IServiceProvider serviceProvider)
    {
    }
}
