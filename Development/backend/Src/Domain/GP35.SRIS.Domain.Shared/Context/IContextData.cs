using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GP35.SRIS.Domain.Shared.Context
{
    public interface IContextData
    {
        string? Email { get; set; }
        string? PhoneNumber { get; set; }
        string? FullName { get; set; }
        string? SessionId { get; set; }
        long UserId { get; set; }
        string? UserName { get; set; }
        string? Code { get; set; }
        long CompanyId { get; set; }
        /// <summary>Role user đăng nhập (Admin/Recruiter/Interviewer/DepartmentManager). Null với khách ẩn danh.</summary>
        string? Role { get; set; }
    }

}
