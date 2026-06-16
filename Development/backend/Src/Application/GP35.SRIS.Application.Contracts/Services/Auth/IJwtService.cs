using GP35.SRIS.Application.Contracts.Dtos;
namespace GP35.SRIS.Application.Contracts;

public interface IJwtService : IBaseService
{
    (string AccessToken, string RefreshToken) GenerateTokens(
        long userId,
        string username,
        IEnumerable<string> roles,
        string companyId,
        string? email = null,
        string? phoneNumber = null,
        string? fullName = null,
        string? code = null);
}
