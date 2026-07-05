using GP35.SRIS.Domain.Entities;

namespace GP35.SRIS.Domain.Repos;

/// <summary>Token refresh/reset của User nội bộ. Tra pre-auth theo hash (không cần tenant context).</summary>
public interface IUserAuthTokenRepo : IBaseRepo<long, UserAuthToken>
{
    Task<long> InsertAsync(UserAuthToken token);

    /// <summary>Tra token theo hash + purpose (chưa dùng, chưa hết hạn kiểm ở service). Null nếu không thấy.</summary>
    Task<UserAuthToken?> GetByHashAsync(string tokenHash, string purpose);

    /// <summary>Đốt 1 token (ghi used_at).</summary>
    Task MarkUsedAsync(long tokenId);

    /// <summary>Thu hồi mọi token còn hiệu lực của 1 user theo purpose (đổi mật khẩu -> hủy refresh cũ).</summary>
    Task RevokeActiveAsync(long userId, string purpose);
}
