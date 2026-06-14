using GP35.SRIS.Domain.Connection;
using Microsoft.Extensions.DependencyInjection;
using GP35.SRIS.Domain.SqlServer.Connection;

namespace GP35.SRIS.Domain.SqlServer.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public static void AddScopedBusinessSqlServerConnectionManager(this IServiceCollection services, Func<string> action)
        {
            services.AddScoped<IConnectionManager>(sp =>
            {
                var connectionString = action.Invoke();
                return new ConnectionManager(connectionString);
            });
        }
    }
}
