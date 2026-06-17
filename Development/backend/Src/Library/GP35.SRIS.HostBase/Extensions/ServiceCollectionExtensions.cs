using AutoMapper;
using GP35.SRIS.Application;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts.Services;
using GP35.SRIS.Application.Services;
using GP35.SRIS.Domain;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Configs;
using GP35.SRIS.Domain.Shared.Context;
using GP35.SRIS.Domain.SqlServer;
using GP35.SRIS.Domain.SqlServer.Extensions;
using GP35.SRIS.Domain.SqlServer.Repos;
using GP35.SRIS.Lib.Services;
using GP35.SRIS.Lib.Services.Ai;
using GP35.SRIS.Application.Contracts.Services.Ai;
using GP35.SRIS.Application.Services.Ai;
using GP35.SRIS.Storage.Minio.Extensions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Reflection;
using Serilog;

namespace GP35.SRIS.HostBase.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public static void ConfigureCommonConfig(this IServiceCollection services, IConfiguration configuration)
        {
            services.InitConfig<DefaultConfig>(configuration);
            services.AddSingleton<Serilog.ILogger>(Log.Logger);
        }

        public static void ConfigureCommonServices(this IServiceCollection services)
        {
            // Register common services here
            // For example, you can add logging, configuration, or other shared services

            // Example: services.AddSingleton<IMyService, MyService>();

            services.AddHttpContextAccessor();
            services.AddHttpClient();
            services.AddScoped<IEncodeService, EncodeService>();
            services.AddScoped<IContextData, ContextData>();

            // AI: gọi HTTP + bóc PDF + sinh embedding (Python AI service)
            services.AddScoped<IHttpService, HttpService>();
            services.AddSingleton<IPdfTextExtractor, PdfTextExtractor>();
            services.AddScoped<IEmbeddingClient, EmbeddingClient>();

            // Lưu trữ file (MinIO, tương thích S3) — đổi sang S3 chỉ cần đổi config/registration này
            services.AddMinioStorage();
        }

        public static void AddBusinessServices(this IServiceCollection services)
        {
            services.AddScoped<IUserRepo, UserRepo>();
            services.AddScoped<ICompanyRepo, CompanyRepo>();

            // AI / CV scoring repos
            services.AddScoped<ICandidateRepo, CandidateRepo>();
            services.AddScoped<IJobRepo, JobRepo>();
            services.AddScoped<ICvDocumentRepo, CvDocumentRepo>();
            services.AddScoped<IApplicationRepo, ApplicationRepo>();
        }

        public static void AddBusinessRepos(this IServiceCollection services, IConfiguration configuration)
        {
            Func<string> connectionStringFactory = () =>
                configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not found.");

            // Tầng dữ liệu thuần EF Core (5.11)
            services.AddSrisDbContext(connectionStringFactory);
            services.AddScoped<IJwtService, JwtService>();
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IUserService, UserService>();
            services.AddScoped<ICompanyService, CompanyService>();
            services.AddScoped<ICvScoringService, CvScoringService>();

        }

        public static void AddAutoMapper(this IServiceCollection services)
        {
            services.AddAutoMapper(cfg =>
            {
                cfg.CreateMap<User, UserGetDto>();
                cfg.CreateMap<Company, CompanyGetDto>();
            });
        }
        public static IConfig InitConfig<IConfig>(this IServiceCollection services, IConfiguration configuration) where IConfig : DefaultConfig
        {
            var config = Activator.CreateInstance<IConfig>();
            new ConfigureFromConfigurationOptions<IConfig>(configuration).Configure(config);

            services.AddSingleton(config);

            return config;
        }
    }
}
