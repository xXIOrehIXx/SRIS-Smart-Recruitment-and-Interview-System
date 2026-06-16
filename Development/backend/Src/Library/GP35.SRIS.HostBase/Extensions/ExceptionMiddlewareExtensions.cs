using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Domain.Shared.Extensions;
using Serilog;
using System;
using System.Buffers.Text;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Mime;
using System.Text;
using System.Threading.Tasks;

namespace GP35.SRIS.HostBase.Extensions
{
    public static class ExceptionMiddlewareExtensions
    {
        public static void ConfigureExceptionHandler(this IApplicationBuilder app, ILogger logger)
        {
            app.UseExceptionHandler(appError =>
            {
                appError.Run(async context =>
                {
                    var contextFeature = context.Features.Get<IExceptionHandlerFeature>();
                    context.Response.ContentType = MediaTypeNames.Application.Json;
                    if (contextFeature != null)
                    {
                        var exception = contextFeature.Error;
                        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                        Console.WriteLine(exception);
                        if (exception is BaseException)
                        {
                            var baseEx = exception as BaseException;
                            context.Response.StatusCode = baseEx.HttpStatus;
                            logger.HereException(contextFeature.Endpoint?.DisplayName, baseEx.ErrorCode).Error(baseEx, $"Có lỗi xảy ra: {baseEx.ErrorMessage}");
                            await context.Response.WriteAsync(new ErrorObjectCommon()
                            {
                                ErrorCode = baseEx.ErrorCode,
                                DevMsg = baseEx.ErrorMessage,
                                UserMsg = baseEx.ErrorMessage
                            }.ToString());
                        }
                        else
                        {
                            logger.HereException(contextFeature.Endpoint?.DisplayName).Error(exception, $"Có lỗi xảy ra");
                            await context.Response.WriteAsync(new ErrorObjectCommon()
                            {
                                ErrorCode = StatusCodes.Status500InternalServerError.ToString(),
                                DevMsg = "Có lỗi server xảy ra",
                                UserMsg = "Có lỗi server xảy ra"
                            }.ToString());
                        }
                    }
                });
            });
        }
    }
}
