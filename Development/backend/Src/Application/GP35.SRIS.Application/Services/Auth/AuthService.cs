using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts;
using Microsoft.Extensions.DependencyInjection;
using GP35.SRIS.Lib.Services;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Application.Contracts.Services;
using GP35.SRIS.Domain.Shared.Constants;
using Microsoft.AspNetCore.Http;

namespace GP35.SRIS.Application;

public class AuthService : BaseService<AuthService>, IAuthService
{
    public AuthService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
    }
    public async Task<LoginResult> LoginAsync(string email, string password)
    {
        var _userService = _serviceProvider.GetRequiredService<IUserService>();

        var user = await _userService.GetByEmail(email);

        if (user == null)
        {
            throw new AuthException
            {
                ErrorCode = AuthErrorCode.UserNotLoggedIn,
                ErrorMessage = AuthErrorMessage.UserNotLoggedIn,
                HttpStatus = StatusCodes.Status401Unauthorized
            };
        }

        var _encodeService = _serviceProvider.GetRequiredService<IEncodeService>();
        var hashed = _encodeService.SHA256WithSalt(password, "salt");

        if (hashed != user.PasswordHash)
        {
            throw new AuthException
            {
                ErrorCode = AuthErrorCode.UsernameOrPwdInvalid,
                ErrorMessage = AuthErrorMessage.UsernameOrPwdInvalid,
                HttpStatus = StatusCodes.Status401Unauthorized
            };
        }

        var _jwtService = _serviceProvider.GetRequiredService<IJwtService>();

        var roles = string.IsNullOrWhiteSpace(user.Role)
            ? new List<string>()
            : new List<string> { user.Role };

        var (accessToken, refreshToken) = _jwtService.GenerateTokens(
            user.UserId,
            user.Email,
            roles,
            user.CompanyId,
            user.Email,
            user.Phone,
            user.FullName,
            user.UserId.ToString());

        //await SaveRefreshTokenAsync(user.Id, refreshToken, user.TenantId);

        return new LoginResult
        {
            CompanyId = user.CompanyId,
            AccessToken = accessToken,
            RefreshToken = refreshToken
        };
    }
}
