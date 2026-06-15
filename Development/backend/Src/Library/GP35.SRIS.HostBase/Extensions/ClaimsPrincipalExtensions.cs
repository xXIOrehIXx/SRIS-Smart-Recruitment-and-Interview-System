using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

using GP35.SRIS.Domain.Shared.Exceptions;

namespace GP35.SRIS.HostBase.Extensions
{
    public static class ClaimsPrincipalExtensions
    {
        public static T GetRequiredClaim<T>(this ClaimsPrincipal principal, string type)
        {
            var value = principal.FindFirstValue(type);
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new AuthException
                {

                };
            }

            return ConvertClaim<T>(value);
        }

        public static T? GetClaim<T>(this ClaimsPrincipal principal, string type)
        {
            var value = principal.FindFirstValue(type);
            return string.IsNullOrWhiteSpace(value) ? default : ConvertClaim<T>(value);
        }

        public static IReadOnlySet<string> GetClaimSet(this ClaimsPrincipal principal, string type)
        {
            var value = principal.FindFirstValue(type);
            return string.IsNullOrWhiteSpace(value)
                ? new HashSet<string>()
                : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToHashSet();
        }

        private static T ConvertClaim<T>(string value)
        {
            if (typeof(T) == typeof(Guid))
                return (T)(object)Guid.Parse(value);
            if (typeof(T) == typeof(int))
                return (T)(object)int.Parse(value);
            return (T)Convert.ChangeType(value, typeof(T));
        }
    }
}
