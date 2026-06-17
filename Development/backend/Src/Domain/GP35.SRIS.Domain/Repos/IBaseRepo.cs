namespace GP35.SRIS.Domain;

/// <summary>
/// Marker chung cho các repository. Tầng dữ liệu dùng EF Core (SrisDbContext);
/// mỗi repo tự khai báo các method nghiệp vụ trong interface riêng của nó.
/// </summary>
public interface IBaseRepo<TKey, T> where T : BaseEntity<TKey>
{
}
