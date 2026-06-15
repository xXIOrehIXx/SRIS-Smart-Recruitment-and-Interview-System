using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace GP35.SRIS.Domain.Shared.Configs
{
    public class DefaultConfig
    {
        public AuthOptions Auth { get; set; }
        public EmailServiceOptions EmailService { get; set; }
    }

    public class AuthOptions
    {
        public string Key { get; set; }
        public string Issuer { get; set; }
        public string Audience { get; set; }
        public string ExpirationMinutes { get; set; }
    }

    public class EmailServiceOptions
    {
        public string EmailURL { get; set; }
        public string PathApiSendEmail { get; set; }
    }
}
