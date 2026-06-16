using System.Net.Mime;
using System.Security.Claims;
using System.Text;

using GP35.SRIS.Domain.Shared.Constants;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.HostBase.Extensions;
using GP35.SRIS.HostBase.Middlewares;

using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

using Serilog;
using Serilog.AspNetCore;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console()
    .WriteTo.File("Logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();


var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog();
var services = builder.Services;
var configuration = builder.Configuration;


services.AddAuthentication(options =>
{
  options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
  options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
  options.TokenValidationParameters = new TokenValidationParameters
  {
    ValidateIssuer = true,
    ValidateAudience = true,
    ValidateLifetime = true,
    ValidateIssuerSigningKey = true,
    ValidIssuer = configuration["Auth:Issuer"],
    ValidAudience = configuration["Auth:Audience"],
    IssuerSigningKey = new SymmetricSecurityKey(
      Encoding.UTF8.GetBytes(configuration["Auth:Key"])),
    ClockSkew = TimeSpan.Zero
  };

  options.Events = new JwtBearerEvents
  {
    OnTokenValidated = async context =>
    {
      var logger = context.HttpContext.RequestServices
          .GetRequiredService<ILogger<Program>>();

      var userId = context.Principal?
          .FindFirst(ClaimTypes.NameIdentifier)?.Value;

      logger.LogInformation("✅ Token validated for user: {UserId}", userId);

      // 👇 Nếu muốn thêm claims từ DB:
      // var dbContext = context.HttpContext.RequestServices
      //     .GetRequiredService<AppDbContext>();
      // var userRoles = await dbContext.UserRoles
      //     .Where(ur => ur.UserId == userId)
      //     .ToListAsync();
      //
      // var claimsIdentity = (ClaimsIdentity)context.Principal!.Identity!;
      // foreach (var role in userRoles)
      //     claimsIdentity.AddClaim(new Claim(ClaimTypes.Role, role.Name));
    },

    OnAuthenticationFailed = async context =>
    {
      var logger = context.HttpContext.RequestServices
          .GetRequiredService<ILogger<Program>>();

      if (!context.Response.HasStarted)
      {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = MediaTypeNames.Application.Json;
        await context.Response.WriteAsync(new ErrorObjectCommon()
        {
          ErrorCode = AuthErrorCode.UserNotLoggedIn,
          DevMsg = AuthErrorMessage.UserNotLoggedIn,
          UserMsg = AuthErrorMessage.UserNotLoggedIn
        }.ToString(), Encoding.UTF8);
      }
    },

    OnChallenge = async context =>
    {
      var logger = context.HttpContext.RequestServices
          .GetRequiredService<ILogger<Program>>();

      context.HandleResponse();

      if (!context.Response.HasStarted)
      {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.ContentType = MediaTypeNames.Application.Json;

        await context.Response.WriteAsync(new ErrorObjectCommon()
        {
          ErrorCode = AuthErrorCode.UserNotLoggedIn,
          DevMsg = AuthErrorMessage.UserNotLoggedIn,
          UserMsg = AuthErrorMessage.UserNotLoggedIn
        }.ToString(), Encoding.UTF8);
      }
    },

    OnForbidden = async context =>
    {
      if (!context.Response.HasStarted)
      {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = MediaTypeNames.Application.Json;

        await context.Response.WriteAsync(new ErrorObjectCommon()
        {
          ErrorCode = AuthErrorCode.UserNotLoggedIn,
          DevMsg = AuthErrorMessage.UserNotLoggedIn,
          UserMsg = AuthErrorMessage.UserNotLoggedIn
        }.ToString(), Encoding.UTF8);
      }
    }
  };
});

builder.Services.AddAuthorization();
services.ConfigureCommonConfig(configuration);
services.ConfigureCommonServices();
services.AddBusinessServices();
services.AddBusinessRepos(configuration);
services.AddAutoMapper();
services
  .AddControllers()
  .AddJsonOptions(options =>
  {
    options.JsonSerializerOptions.PropertyNamingPolicy = null;
  });
services.AddSwaggerGen(c =>
{
  c.SwaggerDoc("v1", new() { Title = "GP35.SRIS API", Version = "v1" });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
  app.UseExceptionHandler("/Error");
  // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
  app.UseHsts();
}

app.ConfigureExceptionHandler(app.Services.GetRequiredService<Serilog.ILogger>());
app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.UseMiddleware<AuthMiddleware>();

app.UseSwagger();
app.UseSwaggerUI((c) =>
{
  c.SwaggerEndpoint("/swagger/v1/swagger.json", "GP35.SRIS API V1");
});

app.MapControllers();

app.Run();
