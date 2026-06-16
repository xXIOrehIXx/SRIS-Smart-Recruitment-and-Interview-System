using Dapper;

using GP35.SRIS.Domain.Connection;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;

using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Domain.SqlServer.Repos;

public class CompanyRepo : BaseRepo<long, Company>, ICompanyRepo
{
	public CompanyRepo(IServiceProvider serviceProvider) : base(serviceProvider)
	{
	}

	public async Task<Company> GetByCompanyId(long companyId)
	{
		var cmd = $"SELECT * FROM {_tableName} WHERE company_id = @companyId";

		return await QuerySingleOrDefaultAsync(cmd, new { companyId });
	}
}
