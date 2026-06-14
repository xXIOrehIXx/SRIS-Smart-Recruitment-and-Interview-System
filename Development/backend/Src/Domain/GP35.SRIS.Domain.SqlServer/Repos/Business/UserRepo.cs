using Dapper;
using GP35.SRIS.Domain.Connection;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using Microsoft.Extensions.DependencyInjection;
using System.Data;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class UserRepo : BaseRepo<Guid, User>, IUserRepo
{
    protected IConnectionManager _connectionManager;

    public UserRepo(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _connectionManager = serviceProvider.GetRequiredService<IConnectionManager>();
    }
    public async Task<User> GetByEmail(string email)
    {
        var connection = await _connectionManager.GetDbConnectionAsync();

        connection.Execute("ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = OFF);");

        var cmd = $"SELECT * FROM {_tableName} WHERE email = @email";
        try
        {
            var user = await connection.QuerySingleOrDefaultAsync<User>(cmd, new { email });

            return user;
        }
        finally
        {
            connection.Execute("ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = ON);");
        }
    }
}
