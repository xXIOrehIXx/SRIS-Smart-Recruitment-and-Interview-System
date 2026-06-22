using System;

namespace GP35.SRIS.HostBase.Authorization
{
    /// <summary>
    /// Giới hạn endpoint theo role Portal (4 role — RoleConstants). AuthMiddleware đọc metadata này
    /// sau khi xác thực: role hiện tại không thuộc danh sách cho phép -> 403. Admin là superuser (luôn qua).
    /// Đặt ở class (áp cả controller) hoặc action (ghi đè ở mức action). Endpoint [AllowAnonymous] bỏ qua.
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
    public sealed class WithRoleAttribute : Attribute
    {
        public string[] Roles { get; }

        public WithRoleAttribute(params string[] roles) => Roles = roles ?? Array.Empty<string>();
    }
}
