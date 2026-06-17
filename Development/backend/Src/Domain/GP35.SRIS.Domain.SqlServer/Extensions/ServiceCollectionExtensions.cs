using Microsoft.Extensions.DependencyInjection;
using GP35.SRIS.Domain.SqlServer.Persistence;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.EntityFrameworkCore;

namespace GP35.SRIS.Domain.SqlServer.Extensions
{
    public static class ServiceCollectionExtensions
    {
        /// <summary>
        /// Đăng ký EF Core DbContext cho tầng dữ liệu (5.11). Scoped để khớp vòng đời
        /// request + IContextData. Interceptor set SESSION_CONTEXT('CompanyId') cho RLS.
        /// </summary>
        public static void AddSrisDbContext(this IServiceCollection services, Func<string> connectionStringFactory)
        {
            services.AddDbContext<SrisDbContext>((sp, options) =>
            {
                options.UseSqlServer(connectionStringFactory.Invoke());
                options.AddInterceptors(
                    new TenantSessionConnectionInterceptor(sp.GetService<IContextData>()));
            }, ServiceLifetime.Scoped);
        }
    }
}
