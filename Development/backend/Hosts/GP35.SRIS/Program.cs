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
        // await context.Response.WriteAsync(new ErrorObjectCommon()
        // {
        //   ErrorCode = AuthErrorCode.UserNotLoggedIn,
        //   DevMsg = AuthErrorMessage.UserNotLoggedIn,
        //   UserMsg = AuthErrorMessage.UserNotLoggedIn
        // }.ToString(), Encoding.UTF8);
        // return;
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

        // await context.Response.WriteAsync(new ErrorObjectCommon()
        // {
        //   ErrorCode = AuthErrorCode.UserNotLoggedIn,
        //   DevMsg = AuthErrorMessage.UserNotLoggedIn,
        //   UserMsg = AuthErrorMessage.UserNotLoggedIn
        // }.ToString(), Encoding.UTF8);
        // return;
      }
    },

    OnForbidden = async context =>
    {
      if (!context.Response.HasStarted)
      {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        context.Response.ContentType = MediaTypeNames.Application.Json;

        // await context.Response.WriteAsync(new ErrorObjectCommon()
        // {
        //   ErrorCode = AuthErrorCode.UserNotLoggedIn,
        //   DevMsg = AuthErrorMessage.UserNotLoggedIn,
        //   UserMsg = AuthErrorMessage.UserNotLoggedIn
        // }.ToString(), Encoding.UTF8);
        // return;
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

  // Nút "Authorize" để dán JWT khi test các endpoint [Authorize].
  c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.OpenApiSecurityScheme
  {
    Name = "Authorization",
    Type = Microsoft.OpenApi.SecuritySchemeType.Http,
    Scheme = "bearer",
    BearerFormat = "JWT",
    In = Microsoft.OpenApi.ParameterLocation.Header,
    Description = "Dán accessToken lấy từ /api/Account/Login (KHÔNG cần gõ 'Bearer ')."
  });
  // QUAN TRỌNG: phải truyền host-document (doc) vào OpenApiSecuritySchemeReference,
  // nếu không reference không phân giải được tên scheme -> key rỗng -> Swagger KHÔNG đính
  // header Authorization vào request (mọi API [Authorize] sẽ trả 401 dù đã bấm Authorize).
  c.AddSecurityRequirement(doc => new Microsoft.OpenApi.OpenApiSecurityRequirement
  {
    {
      new Microsoft.OpenApi.OpenApiSecuritySchemeReference("Bearer", doc),
      new List<string>()
    }
  });
});

var app = builder.Build();

// Tự động chạy DB migration (DbUp) lúc khởi động: có script mới (V003, ...) thì chạy, không thì bỏ qua.
var dbConnection = configuration.GetConnectionString("DefaultConnection");
if (!string.IsNullOrWhiteSpace(dbConnection))
{
  GP35.SRIS.DbMigrator.SrisMigrator.MigrateOrThrow(dbConnection);
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
  app.UseExceptionHandler("/Error");
  // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
  // app.UseHsts();
}

// Global exception handler - phải đứng TRƯỚC ConfigureExceptionHandler
app.Use(async (context, next) =>
{
  try
  {
    await next();
  }
  catch (AuthException ex)
  {
    if (!context.Response.HasStarted)
    {
      context.Response.StatusCode = ex.HttpStatus;
      context.Response.ContentType = MediaTypeNames.Application.Json;
      // await context.Response.WriteAsync(new ErrorObjectCommon()
      // {
      //   ErrorCode = ex.ErrorCode,
      //   DevMsg = ex.ErrorMessage,
      //   UserMsg = ex.ErrorMessage
      // }.ToString(), Encoding.UTF8);
      // return;
    }
  }
  catch (Exception ex)
  {
    if (!context.Response.HasStarted)
    {
      context.Response.StatusCode = StatusCodes.Status500InternalServerError;
      context.Response.ContentType = MediaTypeNames.Application.Json;
      // await context.Response.WriteAsync(new ErrorObjectCommon()
      // {
      //   ErrorCode = "INTERNAL_ERROR",
      //   DevMsg = ex.Message,
      //   UserMsg = "Đã xảy ra lỗi không mong muốn"
      // }.ToString(), Encoding.UTF8);
      // return;
    }
  }
});

app.ConfigureExceptionHandler(app.Services.GetRequiredService<Serilog.ILogger>());

// app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

app.UseCors(o =>
{
    o.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
});

// Swagger phải đứng TRƯỚC AuthMiddleware: AuthMiddleware trả 404 cho mọi request
// không khớp endpoint controller, sẽ chặn cả /swagger nếu đặt sau.
app.UseSwagger();
app.UseSwaggerUI((c) =>
{
  c.SwaggerEndpoint("/swagger/v1/swagger.json", "GP35.SRIS API V1");
});

app.UseAuthentication();
app.UseAuthorization();



// Cổng ứng viên (magic link): giải tenant từ tiền tố token TRƯỚC khi controller/DbContext tạo.
// app.UseMiddleware<CandidateTenantMiddleware>();

// Career Site công khai (/api/public/{slug}): giải tenant từ slug TRƯỚC khi controller/DbContext tạo.
// app.UseMiddleware<CareerSiteTenantMiddleware>();

app.UseMiddleware<AuthMiddleware>();

app.MapControllers();

app.Run();
