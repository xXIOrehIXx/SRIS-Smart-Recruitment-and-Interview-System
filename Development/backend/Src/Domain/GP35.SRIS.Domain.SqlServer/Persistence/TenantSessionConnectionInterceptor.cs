using System.Data.Common;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace GP35.SRIS.Domain.SqlServer.Persistence;

/// <summary>
/// Gán <c>SESSION_CONTEXT('CompanyId')</c> ngay sau khi EF Core mở connection, để Row-Level
/// Security (TenantSecurityPolicy) lọc/cho phép đúng dữ liệu công ty hiện tại.
///
/// BẪY connection pooling (docs 5.2): mỗi lần lấy lại connection từ pool phải set lại session
/// context — interceptor chạy ở MỌI lần open nên xử lý đúng.
///
/// Chưa đăng nhập (companyId &lt;= 0) thì ghi NULL chứ KHÔNG bỏ qua. Bản trước `return` sớm, để
/// nguyên dấu tenant của request trước còn dính trên connection lấy từ pool — request ẩn danh
/// (career site, magic link, login) vớ đúng connection đó là đọc dữ liệu của công ty khác.
/// Ghi NULL thì predicate RLS không khớp gì cả, tức mặc định an toàn đúng nghĩa.
/// </summary>
public sealed class TenantSessionConnectionInterceptor : DbConnectionInterceptor
{
    private const string SetSql = "EXEC sp_set_session_context @key = N'CompanyId', @value = @companyId;";

    private readonly IContextData? _contextData;

    public TenantSessionConnectionInterceptor(IContextData? contextData)
    {
        _contextData = contextData;
    }

    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        using var cmd = CreateSetCommand(connection, _contextData?.CompanyId ?? 0);
        cmd.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        await using var cmd = CreateSetCommand(connection, _contextData?.CompanyId ?? 0);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <summary>companyId &lt;= 0 (chưa đăng nhập) -&gt; ghi NULL để xoá dấu tenant còn sót của
    /// request trước trên connection lấy từ pool.</summary>
    private static DbCommand CreateSetCommand(DbConnection connection, long companyId)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = SetSql;
        var p = cmd.CreateParameter();
        p.ParameterName = "@companyId";
        p.Value = companyId > 0 ? companyId : (object)DBNull.Value;
        cmd.Parameters.Add(p);
        return cmd;
    }
}
