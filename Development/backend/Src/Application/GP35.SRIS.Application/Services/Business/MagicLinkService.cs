using System.Net;
using GP35.SRIS.Application.Contracts.Services.Business;
using GP35.SRIS.Domain.Entities;
using GP35.SRIS.Domain.Repos;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Domain.Shared.Security;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace GP35.SRIS.Application.Services.Business;

/// <summary>
/// Phát/xác thực magic link ứng viên (docs 5.13). Token gốc chỉ tồn tại lúc phát; DB lưu hash.
/// </summary>
public class MagicLinkService : BaseService<MagicLinkService>, IMagicLinkService
{
    private static readonly string[] ValidPurposes = { "QUIZ", "SCHEDULE", "STATUS", "OFFER_RESPONSE" };

    private readonly IMagicLinkTokenRepo _tokenRepo;
    private readonly INotificationService _notify;
    private readonly ILogger _logger;

    public MagicLinkService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
        _tokenRepo = serviceProvider.GetRequiredService<IMagicLinkTokenRepo>();
        _notify = serviceProvider.GetRequiredService<INotificationService>();
        _logger = serviceProvider.GetRequiredService<ILogger>().ForContext<MagicLinkService>();
    }

    public async Task<MagicLinkIssued> IssueAsync(
        long companyId, long applicationId, string purpose, TimeSpan? ttl = null)
    {
        purpose = NormalizePurpose(purpose);

        var raw = MagicLinkTokenCodec.Generate(companyId);
        var expiresAt = DateTime.UtcNow.Add(ttl ?? DefaultTtl(purpose));

        var token = new MagicLinkToken
        {
            ApplicationId = applicationId,
            TokenHash = MagicLinkTokenCodec.Hash(raw),
            Purpose = purpose,
            ExpiresAt = expiresAt
        };
        var tokenId = await _tokenRepo.InsertAsync(companyId, token);

        _logger.Information("MagicLink: phát token id={TokenId} purpose={Purpose} app={AppId} hết hạn {Exp}.",
            tokenId, purpose, applicationId, expiresAt);

        // "Actionable Email" (5.13): mọi lần phát link đều gửi email kèm nút cho ứng viên.
        // Best-effort — NotificationService tự nuốt lỗi, không làm rớt việc phát token.
        await _notify.SendMagicLinkAsync(companyId, applicationId, purpose, raw, expiresAt);

        return new MagicLinkIssued(tokenId, raw, purpose, expiresAt);
    }

    public async Task<MagicLinkValidation> ValidateAsync(string rawToken, string expectedPurpose)
    {
        expectedPurpose = NormalizePurpose(expectedPurpose);

        if (!MagicLinkTokenCodec.TryParseCompanyId(rawToken, out var companyId))
            throw Unauthorized("Liên kết không hợp lệ.");

        var hash = MagicLinkTokenCodec.Hash(rawToken);
        var token = await _tokenRepo.GetByHashAsync(companyId, hash)
            ?? throw Unauthorized("Liên kết không hợp lệ.");

        if (!string.Equals(token.Purpose, expectedPurpose, StringComparison.OrdinalIgnoreCase))
            throw Unauthorized("Liên kết không dùng cho mục đích này.");

        if (token.UsedAt is not null)
            throw Gone("Liên kết đã được sử dụng — hành động đã được chốt trước đó.");

        if (token.ExpiresAt <= DateTime.UtcNow)
            throw Gone("Liên kết đã hết hạn. Vui lòng yêu cầu nhà tuyển dụng gửi lại.");

        // Đếm mỗi lần mở (không đốt — đốt khi chốt).
        await _tokenRepo.IncrementAccessAsync(companyId, token.TokenId);

        return new MagicLinkValidation(companyId, token.TokenId, token.ApplicationId, token.Purpose);
    }

    public Task MarkUsedAsync(long companyId, long tokenId) => _tokenRepo.MarkUsedAsync(companyId, tokenId);

    // ============================================================

    private static string NormalizePurpose(string purpose)
    {
        var p = (purpose ?? "").Trim().ToUpperInvariant();
        if (!ValidPurposes.Contains(p))
            throw Bad($"purpose không hợp lệ: '{purpose}'. Hợp lệ: {string.Join(", ", ValidPurposes)}.");
        return p;
    }

    /// <summary>TTL gợi ý theo purpose (docs 5.13).</summary>
    private static TimeSpan DefaultTtl(string purpose) => purpose switch
    {
        "QUIZ" => TimeSpan.FromHours(48),
        "SCHEDULE" => TimeSpan.FromDays(5),
        "OFFER_RESPONSE" => TimeSpan.FromDays(7),
        "STATUS" => TimeSpan.FromDays(30),
        _ => TimeSpan.FromDays(1)
    };

    private static BaseException Bad(string msg) => new(msg)
    {
        ErrorCode = "BAD_REQUEST", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.BadRequest
    };

    private static BaseException Unauthorized(string msg) => new(msg)
    {
        ErrorCode = "INVALID_MAGIC_LINK", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Unauthorized
    };

    private static BaseException Gone(string msg) => new(msg)
    {
        ErrorCode = "MAGIC_LINK_EXPIRED", ErrorMessage = msg, HttpStatus = (int)HttpStatusCode.Gone
    };
}
