using AutoMapper;
using GP35.SRIS.Domain.Shared.Configs;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace GP35.SRIS.Application.Tests;

/// <summary>
/// Dựng IServiceProvider tối thiểu cho các service kế thừa BaseService (cần IMapper +
/// DefaultConfig + Serilog ILogger). Repo/dịch vụ ngoài đăng ký thêm qua <paramref name="configure"/>.
/// </summary>
internal static class TestHost
{
    public static IServiceProvider Build(Action<IServiceCollection> configure)
    {
        var services = new ServiceCollection();
        services.AddSingleton(Mock.Of<IMapper>());
        services.AddSingleton(new DefaultConfig());
        services.AddSingleton<Serilog.ILogger>(Serilog.Core.Logger.None);
        configure(services);
        return services.BuildServiceProvider();
    }
}
