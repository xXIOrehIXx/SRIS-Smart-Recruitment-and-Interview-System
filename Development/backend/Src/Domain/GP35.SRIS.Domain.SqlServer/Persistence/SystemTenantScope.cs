using GP35.SRIS.Domain.Shared.Constants;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace GP35.SRIS.Domain.SqlServer.Persistence;

/// <summary>
/// Chạy một đoạn truy vấn dưới danh nghĩa tenant "hệ thống" — nhìn xuyên mọi công ty (V049).
///
/// Dùng cho hai loại việc không có tenant: worker hàng đợi giành việc (chạy ngoài request), và
/// các luồng auth ẩn danh (login/refresh/reset mật khẩu — chưa biết người này thuộc công ty nào).
///
/// Cách làm: giữ connection MỞ suốt đoạn đó rồi set <c>SESSION_CONTEXT('CompanyId') = -1</c> lên
/// chính connection ấy. Phải tự mở connection — nếu để EF tự mở/đóng quanh từng câu lệnh thì lệnh
/// set session context và câu truy vấn có thể rơi vào hai connection khác nhau, mà connection trả
/// về pool còn bị <c>sp_reset_connection</c> xoá sạch session context.
///
/// KHÔNG dùng <c>ALTER SECURITY POLICY ... STATE = OFF</c> cho việc này: DDL đó tắt RLS cho TOÀN
/// database (mọi request của mọi tenant), lại còn đua nhau khi nhiều tiến trình cùng bật/tắt —
/// đúng hai lỗi V049 sinh ra để dẹp. Xem <see cref="TenantConstants.SystemCompanyId"/>.
/// </summary>
public static class SystemTenantScope
{
    private static readonly string ReadSql =
        $"SELECT CAST(SESSION_CONTEXT(N'{TenantConstants.SessionKey}') AS BIGINT) AS Value";

    private static readonly string SetSql =
        $"EXEC sp_set_session_context @key = N'{TenantConstants.SessionKey}', @value = @p0;";

    public static async Task<T> RunAsSystemAsync<T>(
        this SrisDbContext db, Func<Task<T>> action, CancellationToken ct = default)
    {
        await db.Database.OpenConnectionAsync(ct);
        try
        {
            // Nhớ giá trị đang có rồi TRẢ LẠI ở cuối, thay vì mặc định xoá về NULL: hàm này cũng
            // được gọi từ trong request (luồng login), mà ở đó connection đang mang tenant thật —
            // xoá trắng là mọi truy vấn sau đó trong cùng request đọc rỗng vì RLS lọc sạch.
            var previous = (await db.Database.SqlQueryRaw<long?>(ReadSql).ToListAsync(ct))
                .FirstOrDefault();

            await SetContextAsync(db, TenantConstants.SystemCompanyId, ct);
            try
            {
                return await action();
            }
            finally
            {
                await SetContextAsync(db, previous, CancellationToken.None);
            }
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    public static async Task RunAsSystemAsync(
        this SrisDbContext db, Func<Task> action, CancellationToken ct = default) =>
        await db.RunAsSystemAsync(async () => { await action(); return 0; }, ct);

    private static Task SetContextAsync(SrisDbContext db, long? value, CancellationToken ct) =>
        db.Database.ExecuteSqlRawAsync(
            SetSql,
            new[] { new SqlParameter("@p0", (object?)value ?? DBNull.Value) },
            ct);
}
