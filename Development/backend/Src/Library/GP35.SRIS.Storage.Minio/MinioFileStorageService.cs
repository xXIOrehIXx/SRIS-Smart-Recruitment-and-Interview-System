using GP35.SRIS.Domain.Shared.Configs;
using Microsoft.Extensions.DependencyInjection;
using Minio;
using Minio.DataModel.Args;
using Serilog;

namespace GP35.SRIS.Storage.Minio;

/// <summary>Cài đặt <see cref="IFileStorageService"/> bằng MinIO (tương thích S3).</summary>
public class MinioFileStorageService : IFileStorageService
{
    private readonly IMinioClient _client;
    private readonly string _bucket;
    private readonly ILogger _logger;
    private bool _bucketChecked;

    public MinioFileStorageService(IServiceProvider serviceProvider)
    {
        var config = serviceProvider.GetRequiredService<DefaultConfig>();
        var opt = config.Storage?.Minio
            ?? throw new InvalidOperationException("Chưa cấu hình 'Storage:Minio'.");

        if (string.IsNullOrWhiteSpace(opt.Endpoint) || string.IsNullOrWhiteSpace(opt.Bucket))
            throw new InvalidOperationException("Cấu hình 'Storage:Minio' thiếu Endpoint hoặc Bucket.");

        _bucket = opt.Bucket;
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<MinioFileStorageService>();
        _client = new MinioClient()
            .WithEndpoint(opt.Endpoint)
            .WithCredentials(opt.AccessKey, opt.SecretKey)
            .WithSSL(opt.UseSSL)
            .Build();
    }

    public async Task<StoredFileInfo> UploadAsync(
        string objectName, Stream content, long size, string contentType,
        CancellationToken cancellationToken = default)
    {
        await EnsureBucketAsync(cancellationToken);

        await _client.PutObjectAsync(new PutObjectArgs()
            .WithBucket(_bucket)
            .WithObject(objectName)
            .WithStreamData(content)
            .WithObjectSize(size)
            .WithContentType(string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType),
            cancellationToken);

        _logger.Information("MinIO uploaded {ObjectName} ({Size} bytes) -> bucket {Bucket}", objectName, size, _bucket);
        return new StoredFileInfo(objectName, size, contentType);
    }

    public async Task<string> GetPresignedUrlAsync(
        string objectName, int expirySeconds = 3600, CancellationToken cancellationToken = default)
    {
        return await _client.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(_bucket)
            .WithObject(objectName)
            .WithExpiry(expirySeconds));
    }

    private async Task EnsureBucketAsync(CancellationToken cancellationToken)
    {
        if (_bucketChecked) return;

        var exists = await _client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucket), cancellationToken);
        if (!exists)
            await _client.MakeBucketAsync(new MakeBucketArgs().WithBucket(_bucket), cancellationToken);

        _bucketChecked = true;
    }
}
