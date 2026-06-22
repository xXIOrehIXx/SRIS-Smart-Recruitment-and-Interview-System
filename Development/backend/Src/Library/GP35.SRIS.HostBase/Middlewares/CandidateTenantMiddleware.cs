using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.HostBase.Middlewares;

/// <summary>
/// Giải tenant cho cổng ứng viên (magic link, không login). Đọc tiền tố companyId của token
/// ("{companyId}.{secret}") rồi set <see cref="IContextData.CompanyId"/> TRƯỚC khi controller
/// (và SrisDbContext) được tạo — để RLS (SESSION_CONTEXT) + Global Query Filter lọc đúng tenant.
///
/// Tiền tố companyId chỉ là gợi ý định tuyến: quyền truy cập vẫn do service xác thực token_hash
/// (sinh từ 32 byte bí mật) trong đúng tenant đó. Đặt companyId sai chỉ tự giới hạn vào tenant
/// không có token hợp lệ -> service trả 401.
/// </summary>
public class CandidateTenantMiddleware
{
    private const string CandidatePathPrefix = "/api/candidate";
    private const string TokenQueryKey = "token";
    private const string TokenHeaderKey = "X-Magic-Token";

    private readonly RequestDelegate _next;

    public CandidateTenantMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments(CandidatePathPrefix, StringComparison.OrdinalIgnoreCase))
        {
            var rawToken = ExtractToken(context.Request);
            if (MagicLinkTokenCodec.TryParseCompanyId(rawToken, out var companyId))
            {
                var contextData = context.RequestServices.GetRequiredService<IContextData>();
                contextData.CompanyId = companyId;
            }
        }

        await _next(context);
    }

    private static string? ExtractToken(HttpRequest request)
    {
        if (request.Query.TryGetValue(TokenQueryKey, out var fromQuery) && !string.IsNullOrWhiteSpace(fromQuery))
            return fromQuery.ToString();

        if (request.Headers.TryGetValue(TokenHeaderKey, out var fromHeader) && !string.IsNullOrWhiteSpace(fromHeader))
            return fromHeader.ToString();

        return null;
    }
}
