using Microsoft.Extensions.DependencyInjection;

namespace GP35.SRIS.Storage.Minio.Extensions;

public static class ServiceCollectionExtensions
{
    /// <summary>Đăng ký MinIO làm implementation của IFileStorageService.</summary>
    public static IServiceCollection AddMinioStorage(this IServiceCollection services)
    {
        services.AddSingleton<IFileStorageService, MinioFileStorageService>();
        return services;
    }
}
