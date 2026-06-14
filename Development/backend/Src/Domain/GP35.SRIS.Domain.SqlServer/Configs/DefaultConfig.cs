using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GP35.SRIS.Domain.SqlServer.Configs
{
    public class DefaultConfig
    {
        public AuthOptions Auth { get; set; }
    }

    public class AuthOptions
    {
        public string Key { get; set; }
        public string Issuer { get; set; }
        public string Audience { get; set; }
        public string ExpirationMinutes { get; set; }
    }
}
