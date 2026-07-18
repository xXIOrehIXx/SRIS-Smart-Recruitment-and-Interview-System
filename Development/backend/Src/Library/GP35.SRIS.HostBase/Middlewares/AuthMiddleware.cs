using System.IdentityModel.Tokens.Jwt;
using System.Net.Mime;
using System.Security.Claims;
using System.Text;

using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.HostBase.Authorization;
using GP35.SRIS.HostBase.Extensions;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

using Serilog;

namespace GP35.SRIS.HostBase.Middlewares
{
    public class AuthMiddleware
    {
        private readonly ILogger _logger;
        private readonly RequestDelegate _next;
        public AuthMiddleware(RequestDelegate next, IServiceProvider serviceProvider)
        {
            _next = next;
            _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<AuthMiddleware>();
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (context.Request.Path.ToString().ToLower().Contains("healthz"))
            {
                await _next(context);
                return;
            }
            var endpoint = context.GetEndpoint();
            if (endpoint == null)
            {
                if (!context.Response.HasStarted)
                {
                    context.Response.StatusCode = StatusCodes.Status404NotFound;
                }
                return;
            }
            // Trường hợp không cần kiểm tra token
            if (endpoint?.Metadata?.GetMetadata<IAllowAnonymous>() is object)
            {
                await _next(context);
                return;
            }
            else
            {
                var canNext = await this.ProcessSession(context);
                if (!canNext)
                {
                    return;
                }

                if (!await this.AuthorizeRole(context, endpoint))
                {
                    return;
                }
            }
            await _next(context);
        }

        /// <summary>
        /// Role gating: nếu endpoint có [WithRole], role hiện tại phải thuộc danh sách cho phép.
        /// Admin là superuser (luôn qua). Không có attribute -> không chặn. Trả false nếu đã ghi 403.
        /// </summary>
        private async Task<bool> AuthorizeRole(HttpContext context, Endpoint endpoint)
        {
            if (context.Response.HasStarted)
            {
                return false;
            }

            var withRole = endpoint.Metadata.GetMetadata<WithRoleAttribute>();
            if (withRole is null || withRole.Roles.Length == 0)
            {
                return true;
            }

            var role = context.RequestServices.GetRequiredService<IContextData>().Role;
            var allowed =
                string.Equals(role, RoleConstants.Admin, StringComparison.OrdinalIgnoreCase) ||
                withRole.Roles.Any(r => string.Equals(r, role, StringComparison.OrdinalIgnoreCase));

            if (allowed)
            {
                return true;
            }

            _logger.Warning("Role gating: chặn role '{Role}' tại {Path} (cần {Roles}).",
                role ?? "(null)", context.Request.Path, string.Join("/", withRole.Roles));

            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = MediaTypeNames.Application.Json;
            await context.Response.WriteAsync(new ErrorObjectCommon()
            {
                ErrorCode = AuthErrorCode.Forbidden,
                DevMsg = $"Role '{role}' không có quyền. Yêu cầu: {string.Join(", ", withRole.Roles)}.",
                UserMsg = AuthErrorMessage.Forbidden
            }.ToString(), Encoding.UTF8);
            return false;
        }

        private async Task<bool> ProcessSession(HttpContext context)
        {
            if (context.Response.HasStarted)
            {
                return false;
            }
            var contextData = context.RequestServices.GetRequiredService<IContextData>();
            var httpContextAccessor = context.RequestServices.GetRequiredService<IHttpContextAccessor>();
            var user = httpContextAccessor.HttpContext?.User;

            if (user?.Identity?.IsAuthenticated != true)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = MediaTypeNames.Application.Json;
                await context.Response.WriteAsync(new ErrorObjectCommon()
                {
                    ErrorCode = AuthErrorCode.UserNotLoggedIn,
                    DevMsg = AuthErrorMessage.UserNotLoggedIn,
                    UserMsg = AuthErrorMessage.UserNotLoggedIn
                }.ToString(), Encoding.UTF8);
                return false;
            }

            contextData.UserId = user.GetRequiredClaim<long>("userId");
            contextData.CompanyId = user.GetRequiredClaim<long>("companyId");
            contextData.Role = user.FindFirst(ClaimTypes.Role)?.Value;
            contextData.Email = user.FindFirst(ClaimTypes.Email)?.Value;
            contextData.FullName = user.FindFirst("full_name")?.Value;

            return true;
        }

    }
}
