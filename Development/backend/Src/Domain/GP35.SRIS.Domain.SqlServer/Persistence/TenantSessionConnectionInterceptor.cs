using System.Data.Common;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace GP35.SRIS.Domain.SqlServer.Persistence;

/// <summary>
/// Gán <c>SESSION_CONTEXT('CompanyId')</c> ngay sau khi EF Core mở connection, để Row-Level
/// Security (TenantSecurityPolicy) lọc/cho phép đúng dữ liệu công ty hiện tại.
///
/// BẪY connection pooling (docs 5.2): mỗi lần lấy lại connection từ pool phải set lại session
/// context — interceptor chạy ở MỌI lần open nên xử lý đúng. Chưa đăng nhập (companyId &lt;= 0)
/// thì bỏ qua, RLS chặn theo mặc định an toàn.
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
        var companyId = _contextData?.CompanyId ?? 0;
        if (companyId <= 0) return;

        using var cmd = CreateSetCommand(connection, companyId);
        cmd.ExecuteNonQuery();
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
    {
        var companyId = _contextData?.CompanyId ?? 0;
        if (companyId <= 0) return;

        await using var cmd = CreateSetCommand(connection, companyId);
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    private static DbCommand CreateSetCommand(DbConnection connection, long companyId)
    {
        var cmd = connection.CreateCommand();
        cmd.CommandText = SetSql;
        var p = cmd.CreateParameter();
        p.ParameterName = "@companyId";
        p.Value = companyId;
        cmd.Parameters.Add(p);
        return cmd;
    }
}
