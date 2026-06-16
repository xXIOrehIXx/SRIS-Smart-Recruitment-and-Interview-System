using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GP35.SRIS.Domain.Shared.Context
{
    public class ContextData : IContextData
    {
        public ContextData()
        {
        }

        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? FullName { get; set; }
        public string? SessionId { get; set; }
        public long UserId { get; set; }
        public string? UserName { get; set; }
        public string? Code { get; set; }
        public long CompanyId { get; set; }
    }
}
