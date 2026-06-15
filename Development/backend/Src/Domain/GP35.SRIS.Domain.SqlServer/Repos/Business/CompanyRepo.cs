using Dapper;
using GP35.SRIS.Domain.Connection;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CompanyRepo : BaseRepo<long, Company>, ICompanyRepo
{
  protected IConnectionManager _connectionManager;

  public CompanyRepo(IServiceProvider serviceProvider) : base(serviceProvider)
  {
    _connectionManager = serviceProvider.GetRequiredService<IConnectionManager>();
  }

  public async Task<Company> GetByCompanyId(long companyId)
  {
    var connection = await _connectionManager.GetDbConnectionAsync();

    connection.Execute("ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = OFF);");

    var cmd = $"SELECT * FROM {_tableName} WHERE company_id = @companyId";
    try
    {
      return await connection.QuerySingleOrDefaultAsync<Company>(cmd, new { companyId });
    }
    finally
    {
      connection.Execute("ALTER SECURITY POLICY [dbo].[TenantSecurityPolicy] WITH (STATE = ON);");
    }
  }
}