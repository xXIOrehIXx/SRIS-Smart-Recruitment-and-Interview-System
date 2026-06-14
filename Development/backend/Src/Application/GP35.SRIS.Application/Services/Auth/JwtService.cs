using GP35.SRIS.Application.Contracts;
using GP35.SRIS.Application.Contracts.Dtos;
using GP35.SRIS.Application.Contracts.Services;
using GP35.SRIS.Domain.Shared.Exceptions;
using GP35.SRIS.Lib.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace GP35.SRIS.Application;

public class JwtService : BaseService<AuthService>, IJwtService
{
    public JwtService(IServiceProvider serviceProvider) : base(serviceProvider)
    {
    }

    public (string AccessToken, string RefreshToken) GenerateTokens(long userId, string username, IEnumerable<string> roles, string companyId)
    {
        var claims = new List<Claim>
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim("companyId", companyId)
        };

        foreach (var role in roles)
            claims.Add(new Claim(ClaimTypes.Role, role));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_defaultConfig.Auth.Key));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var accessToken = new JwtSecurityToken(
            issuer: _defaultConfig.Auth.Issuer,
            audience: _defaultConfig.Auth.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(int.Parse(_defaultConfig.Auth.ExpirationMinutes)),
            signingCredentials: creds);

        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

        return (new JwtSecurityTokenHandler().WriteToken(accessToken), refreshToken);
    }
}
