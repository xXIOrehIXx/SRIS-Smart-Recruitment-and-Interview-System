using AutoMapper;
using GP35.SRIS.Application;
using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts.Services;
using GP35.SRIS.Application.Services;
using GP35.SRIS.Domain;
using GP35.SRIS.Domain.Connection;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.SqlServer;
using GP35.SRIS.Domain.SqlServer.Configs;
using GP35.SRIS.Domain.SqlServer.Connection;
using GP35.SRIS.Domain.SqlServer.Extensions;
using GP35.SRIS.Domain.SqlServer.Repos;
using GP35.SRIS.Lib.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Reflection;

namespace GP35.SRIS.HostBase.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public static void ConfigureCommonConfig(this IServiceCollection services, IConfiguration configuration)
        {
            services.InitConfig<DefaultConfig>(configuration);
        }

        public static void ConfigureCommonServices(this IServiceCollection services)
        {
            // Register common services here
            // For example, you can add logging, configuration, or other shared services

            // Example: services.AddSingleton<IMyService, MyService>();

            services.AddScoped<IEncodeService, EncodeService>();
        }

        public static void AddBusinessServices(this IServiceCollection services)
        {
            services.AddScoped<IUserRepo, UserRepo>();
        }

        public static void AddBusinessRepos(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddScopedBusinessSqlServerConnectionManager(() =>
            {
                var connectionString = configuration.GetConnectionString("DefaultConnection")
                    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not found.");

                return connectionString;
            });
            services.AddScoped<IJwtService, JwtService>();
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IUserService, UserService>();

        }

        public static void AddAutoMapper(this IServiceCollection services)
        {
            services.AddAutoMapper(cfg =>
            {
                cfg.CreateMap<User, UserGetDto>();
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
