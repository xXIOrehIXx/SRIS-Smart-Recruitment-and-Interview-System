using GP35.SRIS.Application.Contracts;
using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using GP35.SRIS.Domain.SqlServer.Configs;

namespace GP35.SRIS.Application;

public class BaseService<T> : IBaseService where T : IBaseService
{
    protected readonly IServiceProvider _serviceProvider;
    protected readonly IMapper _mapper;
    protected readonly DefaultConfig _defaultConfig;

    public BaseService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
        _mapper = serviceProvider.GetRequiredService<IMapper>();
        _defaultConfig = serviceProvider.GetRequiredService<DefaultConfig>();
    }
}
