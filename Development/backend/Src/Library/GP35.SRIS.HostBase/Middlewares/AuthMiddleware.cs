using System.IdentityModel.Tokens.Jwt;
using System.Net.Mime;
using System.Security.Claims;
using System.Text;

using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.Shared.Exceptions;
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
                context.Response.StatusCode = StatusCodes.Status404NotFound;
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
            }
            await _next(context);
        }

        private async Task<bool> ProcessSession(HttpContext context)
        {
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

            return true;
        }

    }
}
