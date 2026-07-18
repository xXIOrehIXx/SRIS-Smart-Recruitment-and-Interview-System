using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Context;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.HostBase.Middlewares;

/// <summary>
/// Giải tenant cho Career Site CÔNG KHAI (`/api/public/{slug}/...`, không login, không magic link).
/// Đọc slug từ path rồi tra companyId qua <see cref="ICompanyRepo.GetBySlugAsync"/>, set
/// <see cref="IContextData.CompanyId"/> TRƯỚC khi controller/DbContext của request được tạo — để cả
/// Global Query Filter (tầng code) lẫn RLS (SESSION_CONTEXT) đều lọc đúng tenant.
///
/// Tra slug chạy trong MỘT scope DI riêng (không dùng DbContext scoped của request) để không "đóng băng"
/// companyId=0 vào DbContext của request. Company là bảng tenant gốc — không nằm dưới RLS — nên tra được
/// khi chưa có SESSION_CONTEXT.
/// </summary>
public class CareerSiteTenantMiddleware
{
    private const string PublicPathPrefix = "/api/public/";

    private readonly RequestDelegate _next;
    private readonly IServiceScopeFactory _scopeFactory;

    public CareerSiteTenantMiddleware(RequestDelegate next, IServiceScopeFactory scopeFactory)
    {
        _next = next;
        _scopeFactory = scopeFactory;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Path format: /api/public/{slug}/...
        // We need to extract the slug segment between /api/public/ and the next /
        if (path.StartsWith(PublicPathPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var remaining = path.Substring(PublicPathPrefix.Length);
            var slashIndex = remaining.IndexOf('/');

            string slug;
            if (slashIndex > 0)
            {
                slug = remaining.Substring(0, slashIndex);
            }
            else if (slashIndex < 0 && remaining.Length > 0)
            {
                // Edge case: /api/public/slug (no trailing slash)
                slug = remaining;
            }
            else
            {
                slug = string.Empty;
            }

            if (!string.IsNullOrWhiteSpace(slug))
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
        }

        await _next(context);
    }
}
