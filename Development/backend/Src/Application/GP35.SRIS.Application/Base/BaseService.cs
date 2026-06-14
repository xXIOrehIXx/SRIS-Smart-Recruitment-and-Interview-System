using GP35.SRIS.Application.Contracts;
using AutoMapper;
using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Application;

public class BaseService<T> : IBaseService where T : IBaseService
{
  protected readonly IServiceProvider _serviceProvider;
  protected readonly IMapper _mapper;

  public BaseService(IServiceProvider serviceProvider)
  {
    _serviceProvider = serviceProvider;
    _mapper = serviceProvider.GetRequiredService<IMapper>();
  }
}
