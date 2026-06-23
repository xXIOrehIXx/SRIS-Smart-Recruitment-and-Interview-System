using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.HostBase.Middlewares;

/// <summary>
/// Giải tenant cho Career Site CÔNG KHAI (`/api/public/{slug}/...`, không login, không magic link).
/// Đọc slug từ route rồi tra companyId qua <see cref="ICompanyRepo.GetBySlugAsync"/>, set
/// <see cref="IContextData.CompanyId"/> TRƯỚC khi controller/DbContext của request được tạo — để cả
/// Global Query Filter (tầng code) lẫn RLS (SESSION_CONTEXT) đều lọc đúng tenant.
///
/// Tra slug chạy trong MỘT scope DI riêng (không dùng DbContext scoped của request) để không "đóng băng"
/// companyId=0 vào DbContext của request. Company là bảng tenant gốc — không nằm dưới RLS — nên tra được
/// khi chưa có SESSION_CONTEXT.
/// </summary>
public class CareerSiteTenantMiddleware
{
    private const string PublicPathPrefix = "/api/public";
    private const string SlugRouteKey = "slug";

    private readonly RequestDelegate _next;
    private readonly IServiceScopeFactory _scopeFactory;

    public CareerSiteTenantMiddleware(RequestDelegate next, IServiceScopeFactory scopeFactory)
    {
        _next = next;
        _scopeFactory = scopeFactory;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments(PublicPathPrefix, StringComparison.OrdinalIgnoreCase)
            && context.Request.RouteValues.TryGetValue(SlugRouteKey, out var slugValue)
            && slugValue is string slug
            && !string.IsNullOrWhiteSpace(slug))
        {
            // Scope riêng: không chạm DbContext scoped của request (tránh đóng băng companyId=0).
            using var scope = _scopeFactory.CreateScope();
            var companyRepo = scope.ServiceProvider.GetRequiredService<ICompanyRepo>();
            var company = await companyRepo.GetBySlugAsync(slug);
            if (company is not null)
            {
                var contextData = context.RequestServices.GetRequiredService<IContextData>();
                contextData.CompanyId = company.CompanyId;
            }
        }

        await _next(context);
    }
}
